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

const $ = (id) => document.getElementById(id);

function fill(s) {
  $('enabled').checked = !!s.enabled;
  $('targetGroup').value = s.targetGroup || '';
  $('prefix').value = s.prefix || '';
  $('delayMs').value = Number(s.delayMs) || 1200;
  $('includeText').checked = !!s.includeText;
  $('includeImages').checked = !!s.includeImages;
  $('includeFiles').checked = !!s.includeFiles;
  $('debug').checked = !!s.debug;
  $('autoScanUnread').checked = !!s.autoScanUnread;
}

function read() {
  return {
    enabled: $('enabled').checked,
    targetGroup: $('targetGroup').value.trim(),
    prefix: $('prefix').value.trim(),
    delayMs: Math.max(300, Number($('delayMs').value) || 1200),
    includeText: $('includeText').checked,
    includeImages: $('includeImages').checked,
    includeFiles: $('includeFiles').checked,
    debug: $('debug').checked,
    autoScanUnread: $('autoScanUnread').checked,
    scanIntervalMs: 20000,
  };
}

function save(showMsg = true) {
  const s = read();
  chrome.storage.sync.set(s, () => {
    if (showMsg) {
      $('saved').textContent = '✓ Đã lưu';
      setTimeout(() => ($('saved').textContent = ''), 1800);
    }
  });
  return s;
}

async function getZaloTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chat.zalo.me/*' });
  return tabs[0] || null;
}

async function refreshStatus() {
  const dot = $('dot');
  const text = $('statusText');
  const tab = await getZaloTab();
  if (!tab) {
    dot.className = 'dot warn';
    text.textContent = 'Chưa mở tab chat.zalo.me — hãy mở và đăng nhập';
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'ZF_STATUS' });
    if (res) {
      dot.className = res.enabled ? 'dot on' : 'dot off';
      const parts = [res.enabled ? 'Đang bật' : 'Đang tắt'];
      if (res.targetGroup) parts.push(`→ ${res.targetGroup}`);
      if (res.queued) parts.push(`${res.queued} đang chờ`);
      text.textContent = parts.join(' · ');
    }
  } catch {
    dot.className = 'dot warn';
    text.textContent = 'Tab Zalo chưa sẵn sàng (thử tải lại trang Zalo)';
  }
}

$('save').addEventListener('click', async () => {
  save();
  await refreshStatus();
});

$('test').addEventListener('click', async () => {
  save(false);
  const tab = await getZaloTab();
  if (!tab) {
    $('saved').textContent = '⚠ Mở tab chat.zalo.me trước';
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'ZF_TEST_FORWARD',
      text: '🧪 Tin thử từ Zalo Forwarder',
    });
    $('saved').textContent = '✓ Đã gửi yêu cầu thử';
  } catch {
    $('saved').textContent = '⚠ Tab Zalo chưa sẵn sàng';
  }
  setTimeout(() => ($('saved').textContent = ''), 2200);
});

chrome.storage.sync.get(DEFAULTS, (s) => {
  fill(s);
  refreshStatus();
});
