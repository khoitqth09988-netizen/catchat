/* CatChat · Lưu/áp dụng theme và hiển thị trạng thái kết nối.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

const THEME_STORAGE_KEY = 'catchat-theme-v1';
/* Khoá cũ từ thời còn tên "cham-chat". Vẫn đọc để người dùng đã chọn giao diện
   trước đây không bị mất lựa chọn sau khi đổi tên khoá. */
const THEME_STORAGE_KEY_LEGACY = 'cham-chat-theme';

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(THEME_STORAGE_KEY_LEGACY);
    return THEME_OPTIONS.some((theme) => theme.id === saved) ? saved : 'light';
  } catch (_) { return 'light'; }
}

function applyTheme(themeId, persist = true) {
  const theme = THEME_OPTIONS.find((item) => item.id === themeId) || THEME_OPTIONS[0];
  document.body.dataset.theme = theme.id;
  els.appView.dataset.theme = theme.id;
  $('meta[name="theme-color"]').setAttribute('content', theme.color);
  $$('[data-theme-choice]', els.themeOptions).forEach((button) => {
    const active = button.dataset.themeChoice === theme.id;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  els.themeStatus.textContent = `Đang dùng giao diện ${theme.name}`;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
      // Giữ luôn khoá cũ để bản đang mở ở tab khác (chưa tải lại) vẫn đọc được.
      localStorage.setItem(THEME_STORAGE_KEY_LEGACY, theme.id);
    } catch (error) { console.warn('Không lưu được cài đặt màu trên thiết bị:', error); }
  }
}

function openThemeDialog() {
  const extras = $('#appearanceExtras');
  if (extras) {
    extras.replaceChildren();
    CatChat.features.run('themeExtras', extras);
  }
  els.themeDialog.hidden = false;
  els.themeDialog.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => els.themeDialog.classList.add('open'));
  document.body.classList.add('body-locked');
  window.setTimeout(() => els.themeOptions.querySelector('[aria-pressed="true"]')?.focus(), 30);
}

function closeThemeDialog() {
  els.themeDialog.classList.remove('open');
  els.themeDialog.setAttribute('aria-hidden', 'true');
  els.themeDialog.hidden = true;
  if (!els.confirmLayer.classList.contains('open') && !els.adminOverlay.classList.contains('open') && els.channelDialog.hidden) {
    document.body.classList.remove('body-locked');
  }
}

function setConnectionState(state) {
  connectionIsOnline = state === 'online';
  // Trình duyệt/tiện ích chặn script long-polling của Firebase (xem early-guard.js):
  // nói rõ nguyên nhân thay vì để người dùng đoán “Mất kết nối” là do mạng.
  const blocked = !connectionIsOnline && window.CatChatEarlyGuard?.isCspBlocked?.() === true;
  els.connectionPill.classList.toggle('online', state === 'online');
  els.connectionPill.classList.toggle('offline', state === 'offline');
  els.connectionPill.title = blocked
    ? 'Trình duyệt hoặc tiện ích đang chặn script của Firebase. Hãy tắt chặn rồi tải lại trang.'
    : '';
  els.connectionLabel.textContent = blocked
    ? 'Bị chặn kết nối'
    : state === 'online' ? 'Đang trực tuyến' : state === 'offline' ? 'Mất kết nối' : 'Đang kết nối';
}
