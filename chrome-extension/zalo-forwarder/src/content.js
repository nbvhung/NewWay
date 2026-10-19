/* =========================================================================
 * Zalo Forwarder — content script
 *
 * Chạy trên https://chat.zalo.me
 * - Theo dõi các tin nhắn ĐẾN (không phải của mình) trong hội thoại đang mở.
 * - Chuyển tiếp nội dung (chữ / ảnh / file) vào MỘT NHÓM CỐ ĐỊNH.
 *
 * LƯU Ý: Zalo Web đổi giao diện khá thường xuyên. Toàn bộ selector nằm trong
 * SELECTORS để dễ sửa. Bật "debug" trong popup để xem log trong Console.
 * ========================================================================= */

(() => {
  'use strict';

  // ─────────────────────────── Cấu hình ───────────────────────────
  const SELECTORS = {
    // Khung danh sách tin nhắn trong hội thoại đang mở
    messageList: [
      '#messageViewScroll',
      '.chat-message-list',
      '[class*="messageViewScroll"]',
      '[class*="message-list"]',
    ],
    // 1 phần tử tin nhắn (nhiều khả năng Zalo dùng id dạng msg-xxxx)
    messageItem: [
      '[id^="msg-"]',
      '[data-msgid]',
      '[data-id][class*="message"]',
      '.message-item',
    ],
    // Ô soạn tin
    composer: [
      '#richInput',
      'div[contenteditable="true"]',
      '[class*="rich-input"]',
    ],
    // Nút gửi
    sendBtn: [
      '#richInputSendBtn',
      '[class*="send-btn"]',
      '[class*="SendBtn"]',
      'button[class*="send"]',
    ],
    // Ô tìm kiếm hội thoại
    searchInput: [
      '#contactSearch',
      'input[placeholder*="Tìm"]',
      'input[placeholder*="tìm"]',
      'input[type="search"]',
    ],
    // 1 kết quả trong danh sách hội thoại
    conversationItem: [
      '[class*="contact-item"]',
      '[class*="conversation-item"]',
      '[class*="conv-item"]',
      '.contact-list-item',
    ],
    // Tiêu đề hội thoại đang mở (để biết đang ở đâu)
    chatHeader: [
      '[class*="chat-header"]',
      '[class*="header-title"]',
      '[class*="conversation-header"]',
    ],
  };

  const DEFAULTS = {
    enabled: false,
    targetGroup: '',
    includeText: true,
    includeImages: true,
    includeFiles: true,
    prefix: '',
    delayMs: 1200,
    debug: false,
    autoScanUnread: false,
    scanIntervalMs: 20000,
  };

  let settings = { ...DEFAULTS };
  let processing = false;
  const queue = [];
  const seen = new Set(); // chữ ký tin đã xử lý (chống trùng)

  // ─────────────────────────── Tiện ích ───────────────────────────
  const log = (...a) => {
    if (settings.debug) console.log('%c[ZF]', 'color:#0ea5e9;font-weight:bold', ...a);
  };
  const warn = (...a) => console.warn('[ZF]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const pick = (list) => {
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };
  const pickAll = (list) => {
    for (const sel of list) {
      const els = document.querySelectorAll(sel);
      if (els.length) return Array.from(els);
    }
    return [];
  };

  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();

  const hashSig = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h >>> 0);
  };

  // ─────────────────────────── Cài đặt ───────────────────────────
  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (s) => {
        settings = { ...DEFAULTS, ...s };
        resolve(settings);
      });
    });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) {
      settings[k] = v.newValue;
    }
    log('settings changed', settings);
  });

  // ─────────────────────────── Nhận diện tin nhắn ───────────────────────────
  function getMessageNodes() {
    const list = pick(SELECTORS.messageList);
    if (!list) return [];
    const items = pickAll(SELECTORS.messageItem);
    if (items.length) return items;

    // Fallback: mọi phần tử con trực tiếp có id/data
    return Array.from(list.children).filter(
      (el) =>
        el.id ||
        el.getAttribute('data-id') ||
        el.getAttribute('data-msgid') ||
        /message|msg/i.test(el.className || ''),
    );
  }

  /** Tin nhắn này là của CHÍNH MÌNH (đã gửi đi) hay của người khác? */
  function isOutgoing(el) {
    // 1) class của chính nó hoặc tổ tiên gần (tối đa 3 cấp) có dấu hiệu "me/self/out"
    let cur = el;
    for (let i = 0; i < 4 && cur; i++, cur = cur.parentElement) {
      const cls = String(cur.className || '').toLowerCase();
      if (/(^|[\s_-])(me|self|out|outgoing|right)([\s_-]|$)/.test(cls)) return true;
      if (/(^|[\s_-])(friend|other|in|incoming|left)([\s_-]|$)/.test(cls)) return false;
      const style = String(cur.getAttribute?.('style') || '');
      if (/justify-content\s*:\s*flex-end|margin-left\s*:\s*auto/.test(style)) return true;
    }
    // 2) Có avatar người gửi => tin đến
    if (el.querySelector('img[class*="avatar"], [class*="avatar"] img')) return false;
    // 3) Mặc định coi là tin đến (an toàn: chỉ forward tin đến)
    return false;
  }

  function isNoiseImage(img) {
    const src = String(img.currentSrc || img.src || '');
    if (!src) return true;
    if (src.startsWith('data:image/svg')) return true;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w && h && (w < 80 || h < 80)) return true; // icon/emoji/avatar
    if (/avatar|emoji|sticker|icon/i.test(src)) return true;
    return false;
  }

  /** Trích nội dung 1 tin nhắn: text + ảnh + file */
  function extractContent(el) {
    const textParts = [];
    const images = [];
    const files = [];

    // Text: ưu tiên các khối text trong bong bóng tin nhắn
    const textSelectors = [
      '.text',
      '[class*="text"]',
      '[class*="content"]',
      '[class*="bubble"]',
      'p',
      'span',
    ];
    const seenText = new Set();
    for (const sel of textSelectors) {
      for (const node of el.querySelectorAll(sel)) {
        if (node.querySelector('img')) continue;
        const t = (node.innerText || '').trim();
        if (!t || seenText.has(t)) continue;
        seenText.add(t);
        textParts.push(t);
      }
      if (textParts.length) break;
    }
    if (!textParts.length) {
      const t = (el.innerText || '').trim();
      if (t) textParts.push(t);
    }

    // Ảnh
    for (const img of el.querySelectorAll('img')) {
      if (isNoiseImage(img)) continue;
      const src = img.currentSrc || img.src;
      if (src) images.push(src);
    }

    // File / tài liệu
    for (const a of el.querySelectorAll('a[href]')) {
      const href = a.href || '';
      const name = (a.getAttribute('download') || a.innerText || '').trim();
      if (!href || href.startsWith('javascript:')) continue;
      if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|txt|csv)$/i.test(href) || name) {
        files.push({ url: href, name: name || href.split('/').pop() || 'file' });
      }
    }

    return {
      text: textParts.join('\n').trim(),
      images: [...new Set(images)],
      files,
    };
  }

  function messageSignature(el, content) {
    const id =
      el.getAttribute?.('data-msgid') ||
      el.getAttribute?.('data-id') ||
      (el.id && el.id.startsWith('msg-') ? el.id : '');
    if (id) return `id:${id}`;
    return `h:${hashSig(
      `${content.text}|${content.images.join(',')}|${content.files.map((f) => f.url).join(',')}`,
    )}`;
  }

  // ─────────────────────────── Điều khiển giao diện ───────────────────────────
  async function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function currentHash() {
    return location.hash || '';
  }

  function headerText() {
    const el = pick(SELECTORS.chatHeader);
    return el ? (el.innerText || '').trim() : '';
  }

  /** Mở hội thoại theo tên (dùng ô tìm kiếm của Zalo). */
  async function openConversationByName(name) {
    const search = pick(SELECTORS.searchInput);
    if (!search) throw new Error('Không tìm thấy ô tìm kiếm hội thoại');

    search.focus();
    await setNativeValue(search, name);
    await sleep(900);

    const target = norm(name);
    const items = pickAll(SELECTORS.conversationItem);
    const hit =
      items.find((it) => norm(it.innerText).includes(target)) ||
      items.find((it) => norm(it.getAttribute('title') || '').includes(target));

    if (!hit) {
      // thử bỏ từ khoá tìm kiếm rồi tìm lại
      await setNativeValue(search, '');
      throw new Error(`Không tìm thấy nhóm/hội thoại "${name}"`);
    }
    hit.click();
    await sleep(1200);
    await setNativeValue(search, '');
    await sleep(300);
  }

  async function openConversationByHash(hash) {
    if (!hash || hash === currentHash()) return;
    location.hash = hash;
    await sleep(1200);
  }

  async function getComposer() {
    for (let i = 0; i < 20; i++) {
      const c = pick(SELECTORS.composer);
      if (c) return c;
      await sleep(250);
    }
    throw new Error('Không tìm thấy ô soạn tin');
  }

  async function sendText(text) {
    if (!text) return;
    const composer = await getComposer();
    composer.focus();
    // Chèn text như người dùng gõ
    try {
      document.execCommand('insertText', false, text);
    } catch {
      composer.textContent = text;
    }
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);

    const btn = pick(SELECTORS.sendBtn);
    if (btn && !btn.disabled) {
      btn.click();
    } else {
      composer.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
        }),
      );
    }
    await sleep(settings.delayMs);
  }

  async function fileFromUrl(url, fallbackName) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tải tệp thất bại: ${res.status}`);
    const blob = await res.blob();
    let name = fallbackName;
    if (!name) {
      const ext = (blob.type.split('/')[1] || 'jpg').split(';')[0];
      name = `image-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    }
    return new File([blob], name, { type: blob.type || 'application/octet-stream' });
  }

  /** Dán ảnh/file vào ô soạn tin bằng sự kiện paste tổng hợp. */
  async function pasteFiles(files) {
    const composer = await getComposer();
    composer.focus();
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);

    const evt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    composer.dispatchEvent(evt);
    await sleep(1500);

    const btn = pick(SELECTORS.sendBtn);
    if (btn && !btn.disabled) btn.click();
    else {
      composer.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
        }),
      );
    }
    await sleep(settings.delayMs);
  }

  // ─────────────────────────── Forward ───────────────────────────
  async function forwardOne(job) {
    const originHash = currentHash();
    const groupName = settings.targetGroup.trim();
    if (!groupName) {
      warn('Chưa cấu hình nhóm đích');
      return;
    }

    // Nếu đang ở chính nhóm đích → không forward (chống vòng lặp)
    if (norm(headerText()).includes(norm(groupName))) {
      log('Đang ở nhóm đích, bỏ qua (chống loop)');
      return;
    }

    try {
      log('Mở nhóm đích:', groupName);
      await openConversationByName(groupName);

      if (settings.prefix) {
        await sendText(settings.prefix);
      }
      if (settings.includeText && job.text) {
        await sendText(job.text);
      }
      if (settings.includeImages && job.images.length) {
        const files = [];
        for (const url of job.images) {
          try {
            files.push(await fileFromUrl(url));
          } catch (e) {
            warn('Bỏ qua ảnh lỗi', url, e.message);
          }
        }
        if (files.length) await pasteFiles(files);
      }
      if (settings.includeFiles && job.files.length) {
        for (const f of job.files) {
          try {
            const file = await fileFromUrl(f.url, f.name);
            await pasteFiles([file]);
          } catch (e) {
            warn('Bỏ qua file lỗi', f.url, e.message);
          }
        }
      }
      log('Đã forward xong:', job.signature);
    } catch (e) {
      warn('Forward lỗi:', e.message);
    } finally {
      // Quay lại hội thoại ban đầu
      await openConversationByHash(originHash);
    }
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;
    try {
      while (queue.length) {
        const job = queue.shift();
        await forwardOne(job);
        await sleep(Math.max(300, settings.delayMs));
      }
    } finally {
      processing = false;
    }
  }

  function enqueue(job) {
    if (!settings.enabled) return;
    if (seen.has(job.signature)) return;
    seen.add(job.signature);
    if (seen.size > 2000) seen.clear();
    queue.push(job);
    log('Xếp hàng forward:', job);
    void drainQueue();
  }

  // ─────────────────────────── Quan sát DOM ───────────────────────────
  function scan() {
    if (!settings.enabled) return;
    const nodes = getMessageNodes();
    if (!nodes.length) return;

    // Chỉ xét các tin ở cuối danh sách (mới nhất) để tránh quét lại lịch sử
    const recent = nodes.slice(-15);
    for (const el of recent) {
      if (el.dataset.zfDone === '1') continue;
      el.dataset.zfDone = '1';

      if (isOutgoing(el)) continue;
      const content = extractContent(el);
      if (!content.text && !content.images.length && !content.files.length) continue;

      const signature = messageSignature(el, content);
      enqueue({ signature, ...content });
    }
  }

  let scanTimer = null;
  const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      try {
        scan();
      } catch (e) {
        warn('scan lỗi:', e.message);
      }
    }, 400);
  };

  function startObserver() {
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    log('Observer đã bật');
    scheduleScan();
  }

  // ─────────── Quét hội thoại CHƯA ĐỌC (tuỳ chọn) ───────────
  const UNREAD_SELECTORS = [
    '[class*="unread"]',
    '[class*="badge"]',
    '[class*="notify"]',
  ];

  function unreadConversations() {
    const items = pickAll(SELECTORS.conversationItem);
    const out = [];
    for (const it of items) {
      let hasUnread = false;
      for (const sel of UNREAD_SELECTORS) {
        const badge = it.querySelector(sel);
        if (badge && (badge.innerText || '').trim()) {
          hasUnread = true;
          break;
        }
      }
      if (!hasUnread) {
        // Fallback: class của item chứa "unread"
        if (/unread/i.test(String(it.className || ''))) hasUnread = true;
      }
      if (hasUnread) out.push(it);
    }
    return out;
  }

  let scanningUnread = false;
  async function scanUnreadLoop() {
    if (scanningUnread || !settings.enabled || !settings.autoScanUnread) return;
    if (processing) return;
    scanningUnread = true;
    const originHash = currentHash();
    try {
      const items = unreadConversations();
      if (items.length) log(`Có ${items.length} hội thoại chưa đọc`);
      for (const item of items.slice(0, 5)) {
        if (!settings.enabled || !settings.autoScanUnread) break;
        item.click();
        await sleep(1500);
        scan();
        // đợi queue xử lý xong trước khi sang hội thoại khác
        for (let i = 0; i < 60 && (processing || queue.length); i++) {
          await sleep(500);
        }
      }
    } catch (e) {
      warn('scanUnread lỗi:', e.message);
    } finally {
      await openConversationByHash(originHash);
      scanningUnread = false;
    }
  }

  function startUnreadScanner() {
    setInterval(() => {
      if (settings.enabled && settings.autoScanUnread) void scanUnreadLoop();
    }, Math.max(5000, Number(settings.scanIntervalMs) || 20000));
    log('Unread scanner đã bật');
  }

  // ─────────────────────────── Khởi động ───────────────────────────
  (async () => {
    await loadSettings();
    // Đợi Zalo render xong
    await sleep(1500);
    startObserver();
    startUnreadScanner();

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'ZF_STATUS') {
        sendResponse({
          enabled: settings.enabled,
          targetGroup: settings.targetGroup,
          queued: queue.length,
          processing,
          header: headerText(),
        });
      } else if (msg?.type === 'ZF_TEST_FORWARD') {
        enqueue({
          signature: `test:${Date.now()}`,
          text: msg.text || 'Test forward từ Zalo Forwarder',
          images: [],
          files: [],
        });
        sendResponse({ ok: true });
      }
      return true;
    });

    log('Zalo Forwarder sẵn sàng', settings);
  })();
})();
