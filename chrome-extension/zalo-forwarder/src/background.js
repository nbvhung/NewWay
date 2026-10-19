/* Service worker: đảm bảo tab Zalo Web tồn tại khi bật extension. */

const ZALO_URL = 'https://chat.zalo.me/';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ enabled: false }, (s) => {
    if (s.enabled) ensureZaloTab();
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get({ enabled: false }, (s) => {
    if (s.enabled) ensureZaloTab();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.enabled) return;
  if (changes.enabled.newValue) ensureZaloTab();
});

async function ensureZaloTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chat.zalo.me/*' });
  if (tabs.length) {
    // Ưu tiên tab đang mở; nếu tab bị discard thì reload
    const t = tabs[0];
    if (t.discarded) await chrome.tabs.reload(t.id);
    return;
  }
  await chrome.tabs.create({ url: ZALO_URL, active: false });
}
