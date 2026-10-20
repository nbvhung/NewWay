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
    scanIntervalMs: 5000,
    /** true = chuột phải tin nhắn → "Chia sẻ" (giữ ảnh gốc, không gửi link). */
    useForward: true,
    /** true = thả 👍 Like vào tin trước khi chia sẻ. */
    reactFirst: true,
  };

  let settings = { ...DEFAULTS };
  let processing = false;
  const queue = [];
  const seen = new Set(); // chữ ký tin đã xử lý (chống trùng trong phiên)
  /** Tin đã xử lý, lưu bền qua reload (khoá = hội thoại + chữ ký). */
  const handled = new Set();
  let handledSaveTimer = null;

  function loadHandled() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ zfHandled: [] }, ({ zfHandled }) => {
        if (Array.isArray(zfHandled)) for (const k of zfHandled) handled.add(k);
        resolve(null);
      });
    });
  }

  function markHandled(key) {
    if (!key) return;
    handled.add(key);
    if (handled.size > 3000) {
      const keep = [...handled].slice(-2000);
      handled.clear();
      keep.forEach((k) => handled.add(k));
    }
    if (handledSaveTimer) return;
    handledSaveTimer = setTimeout(() => {
      handledSaveTimer = null;
      chrome.storage.local.set({ zfHandled: [...handled].slice(-3000) });
    }, 800);
  }

  // ─────────────────────────── Tiện ích ───────────────────────────
  const log = (...a) => {
    if (settings.debug) console.log('%c[ZF]', 'color:#0ea5e9;font-weight:bold', ...a);
  };
  const warn = (...a) => console.warn('[ZF]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Ghi log ra popup (chrome.storage) + console để dễ kiểm tra. */
  function report(level, msg) {
    const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
    try {
      chrome.runtime.sendMessage({ type: 'ZF_LOG', level, msg: line });
    } catch {}
    if (level === 'error') console.error('[ZF]', msg);
    else if (level === 'warn') console.warn('[ZF]', msg);
    else log(msg);
  }

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

  /**
   * Hiển thị thật sự. KHÔNG dùng offsetParent vì phần tử trong khung
   * position:fixed (như ô soạn tin Zalo) có offsetParent = null.
   */
  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

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
    const attrs = ['data-msgid', 'data-message-id', 'data-msg-id', 'data-id'];
    let id = '';
    for (const a of attrs) {
      const v = el.getAttribute?.(a);
      if (v) {
        id = v;
        break;
      }
    }
    // Zalo đặt data-id chung cho cả loại tin (vd div_ReceivedMsg_Text/Photo) —
    // KHÔNG dùng làm khoá vì mọi tin cùng loại sẽ trùng nhau.
    const generic =
      /receivedmsg|div_msg|_msg_text|_msg_photo|_msg_sticker|message_text|message_photo/i.test(
        id,
      ) ||
      !/\d/.test(id) ||
      id.length < 4;
    if (id && !generic) return `id:${id}`;

    // Khoá dự phòng: nội dung + thời gian hiển thị của tin (nếu có).
    const timeEl = el.querySelector(
      '[class*="time"], [class*="Time"], [class*="date"], [class*="Date"]',
    );
    const time = (timeEl?.innerText || '').trim();
    return `h:${hashSig(
      `${content.text}|${content.images.join(',')}|${content.files
        .map((f) => f.url)
        .join(',')}|${time}`,
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

  /** Tìm phần tử hội thoại có tên khớp trong toàn bộ trang (fallback). */
  function findConversationByName(name) {
    const target = norm(name);
    if (!target) return null;
    const seenEls = new Set();
    const candidates = [];

    // Ưu tiên các item theo selector quen thuộc
    const itemLists = [
      '[class*="contact-item"]',
      '[class*="conversation-item"]',
      '[class*="conv-item"]',
      '[class*="contact"] [class*="item"]',
      '[role="listitem"]',
      'li',
    ];
    for (const sel of itemLists) {
      for (const el of document.querySelectorAll(sel)) {
        if (seenEls.has(el)) continue;
        seenEls.add(el);
        const text = norm(el.innerText || '');
        const title = norm(el.getAttribute('title') || '');
        if (!text && !title) continue;
        if (!isVisible(el)) continue;
        if (text.includes(target) || title.includes(target)) candidates.push(el);
      }
    }
    if (!candidates.length) return null;
    // Ưu tiên item có văn bản ngắn nhất (tránh khớp cả khung lớn)
    candidates.sort(
      (a, b) => (a.innerText || '').length - (b.innerText || '').length,
    );
    return candidates[0];
  }

  /** Mở ô tìm kiếm nếu Zalo đang ẩn (bấm icon kính lúp). */
  async function ensureSearchOpen() {
    if (pick(SELECTORS.searchInput)) return true;
    const btn = document.querySelector(
      '[class*="search"], [aria-label*="Tìm"], [aria-label*="tìm"], [aria-label*="Search"], [title*="Tìm"]',
    );
    if (btn) {
      try {
        btn.click();
        await sleep(600);
      } catch {}
    }
    return !!pick(SELECTORS.searchInput);
  }

  /** Mở hội thoại/nhóm theo tên (ô tìm kiếm + fallback quét DOM). */
  async function openConversationByName(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Chưa cấu hình nhóm đích');

    // Nếu đã ở đúng hội thoại rồi thì thôi
    if (norm(headerText()).includes(norm(cleanName))) {
      report('info', `Đang ở hội thoại "${cleanName}"`);
      return;
    }

    await ensureSearchOpen();
    const search = pick(SELECTORS.searchInput);
    if (search) {
      try {
        search.focus();
        await setNativeValue(search, '');
        await sleep(150);
        await setNativeValue(search, cleanName);
        // Gửi Enter để Zalo chạy tìm kiếm
        for (const type of ['keydown', 'keyup']) {
          search.dispatchEvent(
            new KeyboardEvent(type, {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
            }),
          );
        }
        await sleep(1200);
      } catch (e) {
        report('warn', `Lỗi nhập ô tìm kiếm: ${e.message}`);
      }
    } else {
      report('warn', 'Không thấy ô tìm kiếm — thử quét danh sách hội thoại');
    }

    let hit = findConversationByName(cleanName);
    if (!hit) {
      // thử đợi thêm rồi tìm lại
      await sleep(1200);
      hit = findConversationByName(cleanName);
    }
    if (!hit) {
      if (search) await setNativeValue(search, '');
      throw new Error(`Không tìm thấy nhóm/hội thoại "${cleanName}"`);
    }

    // Click vào item hoặc phần tử cha có thể click
    let clickable = hit;
    for (let i = 0; i < 4 && clickable; i++) {
      const cls = String(clickable.className || '');
      if (/item|conv|contact|row/i.test(cls) || clickable.tagName === 'A' || clickable.tagName === 'LI') break;
      clickable = clickable.parentElement;
    }
    (clickable || hit).click();
    await sleep(1400);
    if (search) await setNativeValue(search, '');
    await sleep(300);

    if (!norm(headerText()).includes(norm(cleanName))) {
      report('warn', `Đã click "${cleanName}" nhưng tiêu đề hiện tại: "${headerText()}"`);
    } else {
      report('info', `Đã mở hội thoại "${cleanName}"`);
    }
  }

  async function openConversationByHash(hash) {
    if (!hash || hash === currentHash()) return;
    location.hash = hash;
    await sleep(1200);
  }

  function firstLine(s) {
    return (
      String(s || '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)[0] || ''
    );
  }

  /** Quay lại hội thoại ban đầu: thử hash trước, rồi theo tên. */
  async function restoreConversation(hash, name) {
    if (name && norm(headerText()).includes(norm(name))) return;
    if (hash && hash !== currentHash()) {
      await openConversationByHash(hash);
      if (name && norm(headerText()).includes(norm(name))) return;
    }
    if (name) {
      try {
        await openConversationByName(name);
      } catch (e) {
        report('warn', `Không quay lại được "${name}": ${e.message}`);
      }
    }
  }

  /**
   * Tìm ô soạn tin. Zalo có thể dùng contenteditable="true" | "plaintext-only"
   * | "" hoặc chỉ có thuộc tính contenteditable. Không dựa vào offsetParent.
   */
  async function getComposer() {
    for (let i = 0; i < 60; i++) {
      const editables = Array.from(
        document.querySelectorAll(
          '[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""], [contenteditable]',
        ),
      ).filter(isVisible);
      if (editables.length) {
        editables.sort(
          (a, b) =>
            b.getBoundingClientRect().top - a.getBoundingClientRect().top,
        );
        return editables[0];
      }
      // Fallback theo selector cấu hình
      const c = pick(SELECTORS.composer);
      if (c && isVisible(c)) return c;
      if (i === 20) {
        report('warn', 'Chưa thấy ô soạn tin, tiếp tục chờ...');
      }
      await sleep(250);
    }
    // Thử lần cuối kiểu textarea
    const ta = Array.from(document.querySelectorAll('textarea')).filter(isVisible).pop();
    if (ta) return ta;
    throw new Error('Không tìm thấy ô soạn tin');
  }

  function findSendButton() {
    const cands = Array.from(
      document.querySelectorAll('button, [role="button"]'),
    ).filter(isVisible);
    const scored = cands
      .map((b) => {
        const meta = `${b.className || ''} ${b.getAttribute('aria-label') || ''} ${b.title || ''} ${b.id || ''}`;
        let score = 0;
        if (/send/i.test(meta)) score += 3;
        if (/gửi|gui/i.test(meta)) score += 2;
        if (/submit/i.test(meta)) score += 1;
        const rect = b.getBoundingClientRect();
        // nút gửi thường ở gần đáy màn hình
        score += rect.top / window.innerHeight;
        return { b, score };
      })
      .filter((x) => x.score >= 1)
      .sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].b : null;
  }

  function composerText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return String(el.value || '');
    }
    return String(el.innerText || el.textContent || '');
  }

  function composerEmpty(el) {
    const text = composerText(el).trim();
    const hasImage = !!el.querySelector && !!el.querySelector('img');
    return !text && !hasImage;
  }

  async function insertText(composer, text) {
    composer.focus();
    if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
      composer.value = text;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(composer);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
    } catch {}
    await sleep(150);
    if (!composerText(composer).trim()) {
      // Fallback: đặt trực tiếp + phát sự kiện input
      composer.textContent = text;
      try {
        composer.dispatchEvent(
          new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text,
          }),
        );
        composer.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
        );
      } catch {
        composer.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  async function submitComposer(composer) {
    const btn = findSendButton();
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      btn.click();
      return 'button';
    }
    for (const type of ['keydown', 'keypress', 'keyup']) {
      composer.dispatchEvent(
        new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    return 'enter';
  }

  /** Gửi text và xác minh ô soạn đã trống (tức đã gửi). */
  async function sendText(text) {
    const content = String(text || '').trim();
    if (!content) return true;
    const composer = await getComposer();
    report('info', `Đang gửi: ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`);
    await insertText(composer, content);
    if (!composerText(composer).trim()) {
      report('error', 'Không chèn được chữ vào ô soạn tin');
      return false;
    }
    await submitComposer(composer);
    for (let i = 0; i < 12; i++) {
      await sleep(250);
      if (composerEmpty(composer)) {
        report('success', 'Đã gửi tin');
        await sleep(Math.max(300, settings.delayMs));
        return true;
      }
    }
    // Thử lần 2
    await submitComposer(composer);
    for (let i = 0; i < 8; i++) {
      await sleep(250);
      if (composerEmpty(composer)) {
        report('success', 'Đã gửi tin (lần 2)');
        await sleep(Math.max(300, settings.delayMs));
        return true;
      }
    }
    report('error', 'Ô soạn vẫn còn nội dung — gửi thất bại');
    return false;
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

  /**
   * Dán ảnh/file vào ô soạn tin bằng sự kiện paste tổng hợp.
   * Trả về true nếu gửi được; false để nơi gọi fallback sang gửi link.
   */
  async function pasteFiles(files, fallbackUrls = []) {
    const composer = await getComposer();
    composer.focus();
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);

    const evt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    const before = composerText(composer).trim();
    composer.dispatchEvent(evt);
    await sleep(2200);

    // Nếu paste không tạo preview ảnh/file và ô soạn không đổi → coi như thất bại
    const hasPreview =
      !!composer.querySelector &&
      !!composer.querySelector(
        'img, [class*="preview"], [class*="attachment"], [class*="file"]',
      );
    const after = composerText(composer).trim();
    const changed = hasPreview || after !== before;

    if (!changed) {
      report('warn', 'Dán tệp vào ô soạn không được — thử gửi link thay thế');
      if (fallbackUrls.length) {
        await sendText(fallbackUrls.join('\n'));
        return false;
      }
      return false;
    }

    await submitComposer(composer);
    // Chờ ô soạn trống (đã gửi) — nếu không, thử lần 2
    for (let i = 0; i < 12; i++) {
      await sleep(300);
      if (composerEmpty(composer)) {
        report('success', `Đã gửi ${files.length} tệp`);
        await sleep(Math.max(300, settings.delayMs));
        return true;
      }
    }
    await submitComposer(composer);
    await sleep(1200);
    if (composerEmpty(composer)) {
      report('success', `Đã gửi ${files.length} tệp (lần 2)`);
      return true;
    }
    report('warn', 'Có thể chưa gửi được tệp — thử gửi link thay thế');
    if (fallbackUrls.length) await sendText(fallbackUrls.join('\n'));
    return false;
  }

  // ───────── Chuyển tiếp bằng CHUỘT PHẢI → "Chuyển tiếp" ─────────

  function findLastIncomingNode() {
    const nodes = getMessageNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (!isOutgoing(nodes[i])) return nodes[i];
    }
    return null;
  }

  /** Phần tử nội dung tin nhắn để bấm chuột phải (bong bóng/tin nhắn). */
  function contextTarget(el) {
    const cands = [
      '[class*="content"]',
      '[class*="bubble"]',
      '[class*="text"]',
      'p',
      'span',
    ];
    for (const s of cands) {
      const c = el.querySelector(s);
      if (c && isVisible(c)) return c;
    }
    return el;
  }

  /** Tìm mục trong menu chuột phải theo chữ (ưu tiên gần điểm click). */
  function findMenuItemByText(re, near, excludeEl) {
    const all = Array.from(
      document.querySelectorAll(
        '[role="menuitem"], [class*="menu"] div, [class*="menu"] span, [class*="context"] div, [class*="context"] span, [class*="popup"] div, li, span, div',
      ),
    ).filter(isVisible);
    const seen = new Set();
    const cands = [];
    for (const e of all) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (excludeEl && (e.contains(excludeEl) || excludeEl.contains(e))) continue;
      const t = (e.innerText || '').trim();
      if (!t || t.length > 30 || !re.test(t)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 360 || r.height > 80) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = near ? Math.hypot(cx - near.x, cy - near.y) : 0;
      if (near && dist > 350) continue;
      const exact = t.replace(/\s+/g, ' ').length <= 12 ? 0 : 1;
      cands.push({ e, dist, area: r.width * r.height, exact });
    }
    cands.sort((a, b) => a.exact - b.exact || a.dist - b.dist || a.area - b.area);
    return cands[0]?.e || null;
  }

  // ───────── Cảm xúc (reaction) ─────────

  const EMOJI_RE = /[\u{1F44D}\u{2764}\u{1F606}\u{1F62E}\u{1F622}\u{1F621}\u{1F60D}\u{1F602}]/u;

  /** Tin đã có cảm xúc chưa? (badge reaction hoặc emoji nhỏ dưới bong bóng) */
  function hasReaction(el) {
    if (!el) return false;
    const byClass = Array.from(
      el.querySelectorAll(
        '[class*="reaction" i], [class*="emotion" i], [class*="react" i]',
      ),
    ).filter(isVisible);
    if (byClass.length) return true;

    for (const child of el.querySelectorAll('span, div, img')) {
      if (!isVisible(child)) continue;
      const t = (child.innerText || '').trim();
      if (!t || t.length > 4 || !EMOJI_RE.test(t)) continue;
      const r = child.getBoundingClientRect();
      if (r.width <= 90 && r.height <= 34) return true;
    }
    return false;
  }

  /** Tìm nút cảm xúc/nút Like (ưu tiên trong tin, rồi gần điểm click). */
  function findReactionControl(near, scope) {
    const root = scope || document;
    const els = Array.from(
      root.querySelectorAll('div, span, button, [role="button"], img, i'),
    ).filter(isVisible);
    const cands = [];
    for (const e of els) {
      const alt = e.getAttribute('alt') || '';
      const txt = (e.innerText || '').trim();
      const meta = `${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''} ${e.className || ''} ${alt}`;
      const isLike =
        /cảm xúc|cam xuc|like|thích|thich|reaction|emotion|react/i.test(meta) ||
        txt === '👍' ||
        alt === '👍';
      if (!isLike) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 140 || r.height > 70) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = near ? Math.hypot(cx - near.x, cy - near.y) : 0;
      if (near && dist > 340) continue;
      cands.push({ e, dist, area: r.width * r.height });
    }
    cands.sort((a, b) => a.dist - b.dist || a.area - b.area);
    return cands[0]?.e || null;
  }

  /** Tìm 1 emoji cảm xúc bất kỳ trong thanh reaction (fallback nếu không thấy 👍). */
  function findAnyEmojiControl(near) {
    const els = Array.from(
      document.querySelectorAll('span, div, button, img, i'),
    ).filter(isVisible);
    const cands = [];
    for (const e of els) {
      const t = (e.innerText || '').trim();
      const alt = e.getAttribute('alt') || '';
      const isEmoji =
        (t && t.length <= 2 && EMOJI_RE.test(t)) ||
        (alt && EMOJI_RE.test(alt));
      if (!isEmoji) continue;
      const meta = `${e.className || ''} ${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''} ${e.parentElement?.className || ''} ${e.parentElement?.getAttribute?.('aria-label') || ''}`;
      if (!/react|emotion|cảm xúc|cam xuc|like|thích|thich/i.test(meta)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 60 || r.height > 60) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = near ? Math.hypot(cx - near.x, cy - near.y) : 0;
      if (near && dist > 340) continue;
      cands.push({ e, dist, area: r.width * r.height });
    }
    cands.sort((a, b) => a.dist - b.dist || a.area - b.area);
    return cands[0]?.e || null;
  }

  /** Thả 👍 Like vào tin. Trả về true nếu thấy badge cảm xúc xuất hiện. */
  async function reactMessage(el) {
    if (!el || !el.isConnected) return false;
    const target = contextTarget(el);
    const r = target.getBoundingClientRect();
    const at = {
      x: Math.min(r.right - 8, r.left + r.width - 5),
      y: r.top + r.height / 2,
    };

    // 1) Hover để hiện thanh cảm xúc trong bong bóng
    for (const type of ['mouseenter', 'mouseover', 'mousemove']) {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: at.x,
          clientY: at.y,
          view: window,
        }),
      );
    }
    await sleep(350);
    let like =
      findReactionControl(at, target) ||
      findReactionControl(at, null) ||
      findAnyEmojiControl(at);
    if (like) {
      try {
        like.click();
        await sleep(500);
      } catch {}
      if (hasReaction(el)) return true;
    }

    // 2) Mở menu chuột phải → "Thả cảm xúc"/emoji 👍
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: at.x,
      clientY: at.y,
      button: 2,
      buttons: 2,
    };
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.dispatchEvent(new MouseEvent('contextmenu', opts));
    await sleep(500);

    const item = findMenuItemByText(
      /thả cảm xúc|cảm xúc|cam xuc|yêu thích|yeu thich|like|react/i,
      at,
      target,
    );
    if (item) {
      try {
        item.click();
        await sleep(500);
      } catch {}
    }
    like = findReactionControl(at, null) || findAnyEmojiControl(at);
    if (like) {
      try {
        like.click();
        await sleep(500);
      } catch {}
    }
    // Đóng menu nếu còn
    try {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }),
      );
    } catch {}
    await sleep(200);
    return hasReaction(el);
  }

  /** Tìm hộp thoại "Chuyển tiếp" (modal có ô tìm kiếm). */
  function findForwardDialog() {
    const sels = [
      '[role="dialog"]',
      '[class*="modal"]',
      '[class*="dialog"]',
      '[class*="forward"]',
      '[class*="share"]',
      '[class*="sheet"]',
      '[class*="drawer"]',
      '[class*="popup"]',
    ];
    const seen = new Set();
    const cands = [];
    for (const s of sels) {
      for (const d of document.querySelectorAll(s)) {
        if (seen.has(d) || !isVisible(d)) continue;
        seen.add(d);
        const hasInput = !!d.querySelector('input');
        const looksShare = /chia sẻ|share|chuyển tiếp|forward|người nhận|chọn nhóm/i.test(
          d.innerText || '',
        );
        if (!hasInput && !looksShare) continue;
        const r = d.getBoundingClientRect();
        if (r.width < 200 || r.height < 120) continue;
        cands.push(d);
      }
    }
    cands.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return cands[0] || null;
  }

  async function clickForwardConfirm(dialog) {
    const scope = dialog || document;
    const btns = Array.from(
      scope.querySelectorAll('button, [role="button"], div[class*="btn"]'),
    ).filter(isVisible);
    const prefer = btns.filter((b) => {
      if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
      const meta = `${b.innerText || ''} ${b.getAttribute('aria-label') || ''}`;
      return /chia sẻ|share|chuyển tiếp|gửi|xong|hoàn tất|done|forward/i.test(meta);
    });
    const target = prefer.find((b) => (b.innerText || '').trim().length < 30);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  /** Tìm lại node tin nhắn tương đương (khi Zalo re-render sau khi react). */
  function findEquivalentNode(signature) {
    if (!signature) return null;
    for (const n of getMessageNodes()) {
      if (!n.isConnected || isOutgoing(n)) continue;
      try {
        const c = extractContent(n);
        if (messageSignature(n, c) === signature) return n;
      } catch {}
    }
    return null;
  }

  /** Thả Like (nếu bật) rồi chuột phải tin → "Chia sẻ" → chọn nhóm đích → xác nhận. */
  async function forwardMessageElement(el, groupName, signature) {
    if (!el || !el.isConnected) throw new Error('Tin nhắn không còn trên màn hình');

    // 1) Thả 👍 Like trước (để người gửi biết đã nhận)
    if (settings.reactFirst !== false) {
      let reacted = false;
      try {
        reacted = await reactMessage(el);
      } catch (e) {
        report('warn', `Thả Like lỗi: ${e.message}`);
      }
      report(reacted ? 'success' : 'warn', reacted ? 'Đã thả Like' : 'Không thả được Like — vẫn chia sẻ');
      if (!el.isConnected) {
        const again = findEquivalentNode(signature);
        if (again) el = again;
      }
      await sleep(300);
    }

    if (!el || !el.isConnected) throw new Error('Tin nhắn không còn màn hình sau khi thả Like');
    const target = contextTarget(el);
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    await sleep(350);

    const r = target.getBoundingClientRect();
    const at = {
      x: r.left + Math.min(30, Math.max(5, r.width / 2)),
      y: r.top + Math.min(18, Math.max(5, r.height / 2)),
    };
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: at.x,
      clientY: at.y,
      button: 2,
      buttons: 2,
    };
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.dispatchEvent(new MouseEvent('contextmenu', opts));
    await sleep(600);

    const SHARE_RE = /chia sẻ|share|chuyển tiếp|forward/i;
    let item = findMenuItemByText(SHARE_RE, at, target);
    if (!item) {
      target.dispatchEvent(new MouseEvent('contextmenu', opts));
      await sleep(500);
      item = findMenuItemByText(SHARE_RE, at, target);
    }
    if (!item) {
      const nearby = Array.from(
        document.querySelectorAll('div, span, li, [role="menuitem"]'),
      )
        .filter(isVisible)
        .filter((e) => {
          if (e.contains(target) || target.contains(e)) return false;
          const rr = e.getBoundingClientRect();
          const cx = rr.left + rr.width / 2;
          const cy = rr.top + rr.height / 2;
          return Math.hypot(cx - at.x, cy - at.y) < 350;
        })
        .map((e) => (e.innerText || '').trim())
        .filter((t) => t && t.length <= 30)
        .slice(0, 20)
        .join(' | ');
      throw new Error(
        `Không thấy mục "Chia sẻ" trong menu chuột phải${nearby ? ` (gần: ${nearby})` : ''}`,
      );
    }
    report('info', 'Bấm "Chia sẻ"');
    item.click();
    await sleep(900);

    let dialog = findForwardDialog();
    for (let i = 0; i < 3 && !dialog; i++) {
      await sleep(800);
      dialog = findForwardDialog();
    }
    if (!dialog) throw new Error('Không thấy hộp thoại chia sẻ');
    report('info', 'Đã mở hộp thoại chia sẻ');

    const search = dialog.querySelector(
      'input[type="search"], input[placeholder*="Tìm"], input[placeholder*="tìm"], input[placeholder*="Search"], input',
    );
    const searchEditable = !search
      ? Array.from(dialog.querySelectorAll('[contenteditable="true"]')).find(isVisible)
      : null;
    if (search) {
      search.focus();
      await setNativeValue(search, '');
      await sleep(150);
      await setNativeValue(search, groupName);
      for (const type of ['keydown', 'keyup']) {
        search.dispatchEvent(
          new KeyboardEvent(type, {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
          }),
        );
      }
      await sleep(1300);
    } else if (searchEditable) {
      searchEditable.focus();
      await insertText(searchEditable, groupName);
      await sleep(1300);
    } else {
      report('warn', 'Hộp thoại không có ô tìm kiếm — thử chọn trong danh sách');
    }

    const targetNorm = norm(groupName);
    const rowSel = '[role="option"], [role="listitem"], [class*="item"], li, label';
    let hit = Array.from(dialog.querySelectorAll(rowSel))
      .filter(isVisible)
      .find((x) => norm(x.innerText || '').includes(targetNorm));
    if (!hit && search) {
      await sleep(1000);
      hit = Array.from(dialog.querySelectorAll(rowSel))
        .filter(isVisible)
        .find((x) => norm(x.innerText || '').includes(targetNorm));
    }
    if (!hit) {
      throw new Error(`Không thấy nhóm "${groupName}" trong hộp thoại chia sẻ`);
    }
    hit.click();

    let ok = false;
    for (let i = 0; i < 6 && !ok; i++) {
      await sleep(600);
      ok = (await clickForwardConfirm(dialog)) || (await clickForwardConfirm(null));
    }
    if (!ok) throw new Error('Không thấy nút "Chia sẻ" để xác nhận');
    await sleep(900);

    const still = findForwardDialog();
    if (still) {
      await clickForwardConfirm(still);
      await sleep(600);
    }
    if (findForwardDialog()) {
      throw new Error('Hộp thoại chia sẻ vẫn còn — chưa xác nhận được');
    }
    report('success', `Đã chia sẻ vào "${groupName}"`);
    return true;
  }

  // ─────────────────────────── Forward ───────────────────────────
  async function forwardOne(job) {
    const originHash = currentHash();
    const originName = firstLine(headerText());
    const groupName = settings.targetGroup.trim();
    if (!groupName) {
      report('error', 'Chưa cấu hình nhóm đích');
      return;
    }
    report(
      'info',
      `Xử lý tin (${settings.useForward === false ? 'gửi lại' : 'chia sẻ'}${
        job.el ? ', có tin' : ', KHÔNG có tin'
      })`,
    );

    // Nếu đang ở chính nhóm đích → không forward (chống vòng lặp)
    if (norm(headerText()).includes(norm(groupName))) {
      report('warn', 'Đang ở nhóm đích — bỏ qua (chống loop)');
      return;
    }

    // ── Cách 1 (mặc định): chuột phải nội dung tin → "Chia sẻ" ──
    if (settings.useForward !== false) {
      if (!job.el || !job.el.isConnected) {
        report('warn', 'Tin nhắn không còn hiển thị — bỏ qua (không gửi link)');
        return;
      }
      try {
        await forwardMessageElement(job.el, groupName, job.signature);
      } catch (e) {
        report('error', `Chia sẻ lỗi: ${e.message}`);
      } finally {
        // Chia sẻ có thể khiến Zalo mở nhóm đích → quay lại hội thoại ban đầu.
        await restoreConversation(originHash, originName);
      }
      return;
    }

    // ── Cách 2 (dự phòng): mở nhóm đích rồi gửi lại nội dung ──
    const imageUrls = job.images || [];
    try {
      report('info', `Mở nhóm đích: ${groupName}`);
      await openConversationByName(groupName);

      let ok = true;
      if (settings.prefix) {
        ok = (await sendText(settings.prefix)) && ok;
      }
      if (settings.includeText && job.text) {
        const prefixed = settings.prefix
          ? `${settings.prefix}\n${job.text}`
          : job.text;
        ok = (await sendText(prefixed)) && ok;
      }
      if (settings.includeImages && imageUrls.length) {
        const files = [];
        for (const url of imageUrls) {
          try {
            files.push(await fileFromUrl(url));
          } catch (e) {
            report('warn', `Bỏ qua ảnh lỗi: ${e.message}`);
          }
        }
        if (files.length) await pasteFiles(files, imageUrls);
      }
      if (settings.includeFiles && job.files.length) {
        for (const f of job.files) {
          try {
            const file = await fileFromUrl(f.url, f.name);
            await pasteFiles([file], [f.url]);
          } catch (e) {
            report('warn', `Bỏ qua file lỗi: ${e.message}`);
          }
        }
      }
      report(ok ? 'success' : 'warn', `Xong forward (${job.signature})`);
    } catch (e) {
      report('error', `Forward lỗi: ${e.message}`);
    } finally {
      // Quay lại hội thoại ban đầu
      await restoreConversation(originHash, originName);
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
    report('info', `Phát hiện tin mới → chuẩn bị chuyển (${job.signature})`);
    queue.push(job);
    void drainQueue();
  }

  // ─────────────────────────── Quan sát DOM ───────────────────────────
  let lastConvKey = '';

  function convKey() {
    return `${firstLine(headerText())}|${currentHash()}`;
  }

  function handledKey(signature) {
    return `${norm(firstLine(headerText()))}|${signature}`;
  }

  /** Đánh dấu 1 tin (đang hiển thị) là đã xử lý — để re-render không gửi lại. */
  function markNodeHandled(el) {
    try {
      const c = extractContent(el);
      if (!c.text && !c.images.length && !c.files.length) return;
      markHandled(handledKey(messageSignature(el, c)));
    } catch {}
  }

  /**
   * Xử lý 1 tin: bỏ qua tin của mình, tin đã có cảm xúc, tin đã xử lý trước đó.
   * `allowBaseline` dùng cho quét chưa đọc (tin cũ nhưng chưa react).
   */
  function processNode(el, { allowBaseline = false } = {}) {
    if (!el || !el.isConnected) return;
    if (!allowBaseline && el.dataset.zfBase === '1') return;
    if (el.dataset.zfDone === '1') return;
    el.dataset.zfDone = '1';

    if (isOutgoing(el)) return;
    if (hasReaction(el)) {
      report('info', 'Bỏ qua tin đã có cảm xúc');
      return;
    }

    const content = extractContent(el);
    if (!content.text && !content.images.length && !content.files.length) return;
    const signature = messageSignature(el, content);
    const hkey = handledKey(signature);
    if (handled.has(hkey)) {
      report('info', 'Bỏ qua tin đã xử lý trước đó');
      return;
    }
    markHandled(hkey);
    enqueue({ signature, ...content, el });
  }

  function scan() {
    if (!settings.enabled) return;
    const nodes = getMessageNodes();
    if (!nodes.length) return;

    const key = convKey();
    if (key !== lastConvKey) {
      // Vừa vào hội thoại mới → coi mọi tin đang hiển thị là "cũ" (không gửi tồn đọng).
      lastConvKey = key;
      for (const el of nodes) {
        el.dataset.zfBase = '1';
        markNodeHandled(el);
      }
      report('info', `Vào hội thoại mới → bỏ qua ${nodes.length} tin cũ`);
      return;
    }

    for (const el of nodes) {
      if (el.dataset.zfBase === '1') continue;
      processNode(el);
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

  /** Lấy các dòng hội thoại ở cột trái (không phụ thuộc class cụ thể). */
  function getConversationItems() {
    const out = [];
    const seen = new Set();
    const selectors = [
      '[class*="conv-item"]',
      '[class*="conversation-item"]',
      '[class*="contact-item"]',
      '[class*="thread-item"]',
      '[role="listitem"]',
      '[role="button"]',
      'li',
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (!isVisible(el)) continue;
        const r = el.getBoundingClientRect();
        // Chỉ lấy dòng trong cột danh sách hội thoại bên trái
        if (r.left > 440 || r.width < 90 || r.height < 36 || r.height > 140) continue;
        const text = (el.innerText || '').trim();
        if (!text || text.length > 300) continue;
        out.push(el);
      }
    }
    return out;
  }

  function hasUnreadBadge(el) {
    if (/unread/i.test(String(el.className || ''))) return true;
    const label = String(el.getAttribute('aria-label') || '');
    if (/chưa đọc|unread|未读/i.test(label)) return true;
    const badgeSelectors = [
      '[class*="unread"]',
      '[class*="badge"]',
      '[class*="count"]',
      '[class*="notify"]',
    ];
    for (const sel of badgeSelectors) {
      for (const b of el.querySelectorAll(sel)) {
        if (!isVisible(b)) continue;
        const t = (b.innerText || '').trim();
        if (/^\d+$/.test(t)) return true;
        if (/unread/i.test(String(b.className || ''))) return true;
      }
    }
    return false;
  }

  function unreadConversations() {
    return getConversationItems().filter(hasUnreadBadge);
  }

  /** Số tin chưa đọc hiển thị trên dòng hội thoại (nếu có). */
  function getUnreadCount(el) {
    const sels = [
      '[class*="unread"]',
      '[class*="badge"]',
      '[class*="count"]',
      '[class*="notify"]',
    ];
    for (const sel of sels) {
      for (const b of el.querySelectorAll(sel)) {
        if (!isVisible(b)) continue;
        const m = (b.innerText || '').match(/(\d+)/);
        if (m) return Number(m[1]);
      }
    }
    const m = String(el.getAttribute('aria-label') || '').match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  /** Tìm dấu "Tin nhắn chưa đọc" trong khung chat. */
  function findUnreadDivider() {
    for (const root of [pick(SELECTORS.messageList), document].filter(Boolean)) {
      for (const e of root.querySelectorAll('div, span, p')) {
        if (!isVisible(e)) continue;
        const t = (e.innerText || '').trim();
        if (!t || t.length > 60) continue;
        if (/tin nhắn chưa đọc|unread messages?/i.test(t)) return e;
      }
    }
    return null;
  }

  /** Chờ danh sách tin ổn định (nhanh, ~240ms) thay vì sleep cố định. */
  async function waitForMessageList(timeoutMs = 2000) {
    const start = Date.now();
    let last = -1;
    let stable = 0;
    while (Date.now() - start < timeoutMs) {
      const n = getMessageNodes().length;
      if (n === last) stable += 1;
      else {
        stable = 0;
        last = n;
      }
      if (n > 0 && stable >= 2) return;
      await sleep(120);
    }
  }

  /** Mở 1 hội thoại chưa đọc và chỉ xử lý các tin MỚI (sau dấu chưa đọc / N tin cuối). */
  async function scanUnreadConversation(item, unreadCount) {
    item.click();
    await waitForMessageList();
    const nodes = getMessageNodes();
    if (!nodes.length) return;
    lastConvKey = convKey();
    // Đánh dấu toàn bộ là "cũ"; chỉ mở khoá các tin mục tiêu bên dưới.
    for (const el of nodes) el.dataset.zfBase = '1';

    let targets = [];
    const divider = findUnreadDivider();
    if (divider) {
      targets = nodes.filter(
        (n) =>
          divider.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    } else if (unreadCount > 0) {
      targets = nodes.filter((n) => !isOutgoing(n)).slice(-unreadCount);
    } else {
      targets = nodes.filter((n) => !isOutgoing(n)).slice(-1);
    }

    if (!targets.length) return;
    // Các tin cũ (không nằm trong mục tiêu) coi như đã xử lý → re-render không gửi lại.
    for (const el of nodes) {
      if (!targets.includes(el)) markNodeHandled(el);
    }
    report(
      'info',
      `Hội thoại: xử lý ${targets.length} tin mới${
        divider ? ' (sau dấu chưa đọc)' : unreadCount ? ` (${unreadCount} tin cuối)` : ''
      }`,
    );
    for (const el of targets) processNode(el, { allowBaseline: true });
  }

  let scanningUnread = false;
  async function scanUnreadLoop(force = false) {
    if (scanningUnread) return;
    if (!settings.enabled) {
      if (force) report('warn', 'Chưa bật "Bật chuyển tiếp"');
      return;
    }
    if (!force && !settings.autoScanUnread) return;
    if (processing) return;
    scanningUnread = true;
    const originHash = currentHash();
    const originName = firstLine(headerText());
    try {
      const all = getConversationItems();
      const items = all.filter(hasUnreadBadge);
      report(
        'info',
        `Quét hội thoại: thấy ${all.length} dòng, ${items.length} có tin chưa đọc`,
      );
      const maxPerRun = 5;
      for (const item of items.slice(0, maxPerRun)) {
        if (!settings.enabled) break;
        try {
          await scanUnreadConversation(item, getUnreadCount(item));
        } catch (e) {
          report('warn', `Quét hội thoại lỗi: ${e.message}`);
        }
        // Chờ hàng đợi xử lý xong — poll nhanh 150ms.
        for (let i = 0; i < 80 && (processing || queue.length); i++) {
          await sleep(150);
        }
      }
      if (items.length > maxPerRun) {
        report('info', `Còn ${items.length - maxPerRun} hội thoại, vòng sau quét tiếp`);
      }
    } catch (e) {
      report('error', `Quét chưa đọc lỗi: ${e.message}`);
    } finally {
      await restoreConversation(originHash, originName);
      scanningUnread = false;
    }
  }

  function startUnreadScanner() {
    setInterval(() => {
      if (settings.enabled && settings.autoScanUnread) void scanUnreadLoop();
    }, Math.min(8000, Math.max(3000, Number(settings.scanIntervalMs) || 5000)));
    report('info', 'Bộ quét hội thoại chưa đọc đã chạy (mặc định 5s/lần)');
  }

  // ─────────────────────────── Khởi động ───────────────────────────
  (async () => {
    await loadSettings();
    await loadHandled();

    // Đợi Zalo render xong
    await sleep(1500);
    startObserver();
    startUnreadScanner();

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'ZF_SCAN_NOW') {
        void scanUnreadLoop(true);
        sendResponse({ ok: true });
      } else if (msg?.type === 'ZF_OPEN_TARGET') {
        (async () => {
          try {
            const g = settings.targetGroup.trim();
            if (!g) throw new Error('Chưa cấu hình nhóm đích');
            await openConversationByName(g);
            report('success', `Đã mở nhóm đích "${g}"`);
          } catch (e) {
            report('error', `Không mở được nhóm đích: ${e.message}`);
          }
        })();
        sendResponse({ ok: true });
      } else if (msg?.type === 'ZF_STATUS') {
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
          // Có tin gần nhất → chuyển tiếp chính tin đó (chuột phải).
          el: findLastIncomingNode(),
        });
        sendResponse({ ok: true });
      }
      return true;
    });

    log('Zalo Forwarder sẵn sàng', settings);
  })();
})();
