/* Service worker: điều phối tab Zalo, tab gửi (worker) và lưu log. */

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
  if (area === 'local' && changes.workerTabId) {
    // Báo cho tất cả tab Zalo biết đâu là tab gửi
    chrome.tabs.query({ url: 'https://chat.zalo.me/*' }, (tabs) => {
      const workerId = changes.workerTabId.newValue;
      for (const t of tabs) {
        chrome.tabs
          .sendMessage(t.id, { type: 'ZF_SET_WORKER', value: t.id === workerId })
          .catch(() => {});
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get({ workerTabId: null }, ({ workerTabId }) => {
    if (workerTabId === tabId) {
      chrome.storage.local.set({ workerTabId: null });
    }
  });
});

async function ensureZaloTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chat.zalo.me/*' });
  if (tabs.length) {
    if (tabs[0].discarded) await chrome.tabs.reload(tabs[0].id);
    return;
  }
  await chrome.tabs.create({ url: ZALO_URL, active: false });
}

async function getWorkerTabId() {
  const { workerTabId } = await chrome.storage.local.get({ workerTabId: null });
  if (!workerTabId) return null;
  try {
    const tab = await chrome.tabs.get(workerTabId);
    if (!tab || !String(tab.url || '').startsWith('https://chat.zalo.me')) return null;
    return workerTabId;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ── Log từ content script ──
  if (msg?.type === 'ZF_LOG') {
    chrome.storage.local.get({ zfLogs: [] }, ({ zfLogs }) => {
      const next = [
        { at: Date.now(), level: msg.level || 'info', msg: msg.msg || '' },
        ...(Array.isArray(zfLogs) ? zfLogs : []),
      ].slice(0, 300);
      chrome.storage.local.set({ zfLogs: next });
    });
    return false;
  }

  // ── Content hỏi: tab này có phải tab gửi không? ──
  if (msg?.type === 'ZF_GET_CONTEXT') {
    getWorkerTabId().then((workerTabId) => {
      sendResponse({ tabId: sender.tab?.id ?? null, workerTabId });
    });
    return true;
  }

  // ── Đặt tab hiện tại làm TAB GỬI ──
  if (msg?.type === 'ZF_SET_WORKER') {
    const id = Number(msg.tabId);
    if (!Number.isFinite(id)) {
      sendResponse({ ok: false });
      return true;
    }
    chrome.storage.local.set({ workerTabId: id }, () => {
      chrome.tabs
        .sendMessage(id, { type: 'ZF_SET_WORKER', value: true })
        .catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }

  // ── Tin mới: ưu tiên chuyển sang TAB GỬI; nếu chưa có thì tab nguồn tự xử lý ──
  if (msg?.type === 'ZF_JOB') {
    getWorkerTabId().then(async (workerTabId) => {
      if (!workerTabId) {
        sendResponse({ routed: false });
        return;
      }
      try {
        await chrome.tabs.sendMessage(workerTabId, {
          type: 'ZF_SEND_DIRECT',
          job: msg.job,
        });
        sendResponse({ routed: true });
      } catch {
        sendResponse({ routed: false });
      }
    });
    return true;
  }

  return false;
});
