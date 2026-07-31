import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  const vars = {};
  if (!existsSync(file)) return vars;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    let key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (value.includes('#')) {
      const h = value.indexOf('#');
      value = value.slice(0, h).trim();
    }
    vars[key] = value;
  }
  return vars;
}

async function detectNgrokUrl() {
  try {
    const res = await fetch('http://localhost:4040/api/tunnels');
    if (!res.ok) return null;
    const data = await res.json();
    const tunnels = data?.tunnels || [];
    const https = tunnels.find((t) => t?.public_url?.startsWith('https://'));
    return https?.public_url || null;
  } catch {
    return null;
  }
}

const env = { ...loadEnv(join(ROOT, '.env')), ...process.env };

const token = env.ZALO_BOT_TOKEN;
const secret = env.ZALO_WEBHOOK_SECRET;

if (!token) {
  console.error('[webhook:set] LỖI: Thiếu ZALO_BOT_TOKEN trong be/.env');
  process.exit(1);
}
if (!secret) {
  console.error('[webhook:set] LỖI: Thiếu ZALO_WEBHOOK_SECRET trong be/.env');
  process.exit(1);
}

let webhookUrl = env.ZALO_WEBHOOK_URL || '';
if (webhookUrl) {
  console.log(`[webhook:set] Dùng ZALO_WEBHOOK_URL: ${webhookUrl}`);
} else {
  const base = await detectNgrokUrl();
  if (!base) {
    console.error(
      '[webhook:set] LỖI: Không dò được URL ngrok. Chạy ngrok trước,\n' +
      '  hoặc đặt ZALO_WEBHOOK_URL trong be/.env (vd https://xxx.ngrok-free.app/api/zalo/webhook).'
    );
    process.exit(1);
  }
  webhookUrl = `${base}/api/zalo/webhook`;
  console.log(`[webhook:set] URL ngrok phát hiện: ${webhookUrl}`);
}

const api = (path) => `https://bot-api.zaloplatforms.com/bot${token}/${path}`;

console.log('[webhook:set] Đang gọi setWebhook...');
const res = await fetch(api('setWebhook'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
});
const result = await res.json().catch(() => ({}));

if (!res.ok || result?.ok === false) {
  console.error('[webhook:set] THẤT BẠI:', JSON.stringify(result));
  process.exit(1);
}
console.log('[webhook:set] OK:', JSON.stringify(result));

const infoRes = await fetch(api('getWebhookInfo'));
const info = await infoRes.json().catch(() => ({}));
console.log('[webhook:set] getWebhookInfo:', JSON.stringify(info));
