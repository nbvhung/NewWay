/* Service worker: mở tab Zalo khi bật extension và lưu log hiển thị ở popup. */

const ZALO_URL = 'https://chat.zalo.me/';

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: false });
  if (enabled) ensureZaloTab();
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: false });
  if (enabled) ensureZaloTab();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled?.newValue) ensureZaloTab();
});

async function ensureZaloTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chat.zalo.me/*' });
  if (tabs.length) {
    if (tabs[0].discarded) await chrome.tabs.reload(tabs[0].id);
    return;
  }
  await chrome.tabs.create({ url: ZALO_URL, active: false });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'ZF_LOG') return;
  chrome.storage.local.get({ zfLogs: [] }, ({ zfLogs }) => {
    const next = [
      { at: Date.now(), level: msg.level || 'info', msg: msg.msg || '' },
      ...(Array.isArray(zfLogs) ? zfLogs : []),
    ].slice(0, 300);
    chrome.storage.local.set({ zfLogs: next });
  });
});
