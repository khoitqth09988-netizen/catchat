/* CatChat · Màn hình chờ (splash) có tiến trình thật.
   API cho các file khác:
     CatChat.bootScreen.step('Đang kết nối…', 40)   cập nhật nhãn + phần trăm
     CatChat.bootScreen.finish()                    đóng splash và mở app
     CatChat.bootScreen.fail('...')                 hiện lỗi + nút thử lại
   Script chạy độc lập, không phụ thuộc Firebase hay feature registry. */
'use strict';

(() => {
  const CatChatApp = window.CatChat || (window.CatChat = {});
  // Ưu tiên tuỳ chọn của người dùng (assets/js/features/motion.js) để Windows
  // đang tắt hiệu ứng vẫn xem được animation nếu họ chọn “Đầy đủ”.
  const prefersReducedMotion = () => {
    const preference = window.CatChat?.motion;
    if (preference && typeof preference.isReduced === 'function') return preference.isReduced();
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  };
  const MIN_VISIBLE = prefersReducedMotion() ? 0 : 720;
  const SLOW_HINT_AFTER = 15000;
  const EXIT_MS = prefersReducedMotion() ? 30 : 500;
  const startedAt = Date.now();

  let screen = null;
  let bar = null;
  let fill = null;
  let stepEl = null;
  let errorBox = null;
  let errorText = null;
  let percent = 6;
  let closed = false;
  let hintedSlow = false;
  let swapTimer = null;
  let closeTimer = null;

  function pick(id) {
    return document.getElementById(id) || null;
  }

  function ensure() {
    if (screen) return true;
    screen = pick('bootScreen');
    if (!screen) return false;
    bar = pick('bootProgressBar');
    fill = pick('bootProgressFill');
    stepEl = pick('bootStep');
    errorBox = pick('bootError');
    errorText = pick('bootErrorText');
    const retry = pick('bootRetry');
    if (retry && !retry.dataset.bound) {
      retry.dataset.bound = '1';
      retry.addEventListener('click', () => window.location.reload());
    }
    return true;
  }

  function paint(nextPercent) {
    percent = Math.max(percent, Math.min(100, Math.round(nextPercent)));
    if (fill) fill.style.width = `${percent}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(percent));
  }

  /** Đổi nhãn bước hiện tại với hiệu ứng mờ dần (tránh nháy chữ). */
  function step(label, nextPercent) {
    if (closed) return;
    if (!ensure()) return;
    if (typeof nextPercent === 'number') paint(nextPercent);
    const text = String(label || '').trim();
    if (!text || !stepEl) return;
    if (stepEl.textContent === text) return;
    if (prefersReducedMotion()) {
      stepEl.textContent = text;
      return;
    }
    stepEl.classList.add('is-swapping');
    window.clearTimeout(swapTimer);
    swapTimer = window.setTimeout(() => {
      stepEl.textContent = text;
      stepEl.classList.remove('is-swapping');
    }, 140);
  }

  function revealApp() {
    document.body.classList.add('booted');
    const authView = document.getElementById('authView');
    const appView = document.getElementById('appView');
    if (authView && !authView.hidden) authView.classList.add('view-ready');
    if (appView && !appView.hidden) appView.classList.add('view-ready');
  }

  /** Đóng splash. Gọi nhiều lần cũng an toàn. */
  function finish() {
    if (closed) return;
    closed = true;
    if (!ensure()) {
      document.body.classList.add('booted');
      return;
    }
    window.clearTimeout(closeTimer);
    paint(100);
    if (errorBox) errorBox.hidden = true;
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - startedAt));
    closeTimer = window.setTimeout(() => {
      screen.classList.add('is-hidden');
      screen.setAttribute('aria-hidden', 'true');
      revealApp();
      window.setTimeout(() => {
        screen.remove();
        screen = null;
      }, EXIT_MS + 80);
    }, wait);
  }

  /** Hiện lỗi chặn khởi động (ví dụ không tải được Firebase SDK). */
  function fail(message) {
    if (!ensure()) return;
    window.clearTimeout(closeTimer);
    closed = false;
    screen.classList.add('is-failed');
    if (errorBox) errorBox.hidden = false;
    if (errorText) errorText.textContent = String(message || 'Không kết nối được tới máy chủ CatChat.');
    if (stepEl) stepEl.textContent = 'Không thể khởi động';
    if (bar) bar.setAttribute('aria-valuenow', String(percent));
    const retry = pick('bootRetry');
    if (retry) retry.focus({ preventScroll: true });
  }

  function hintSlowNetwork() {
    if (closed || hintedSlow) return;
    hintedSlow = true;
    step('Mạng hơi chậm — vẫn đang kết nối…', Math.max(percent, 72));
    if (errorBox) {
      errorBox.hidden = false;
      if (errorText) errorText.textContent = 'Nếu mạng đã ổn mà màn hình vẫn đứng yên, hãy thử tải lại trang.';
    }
  }

  if (ensure()) {
    paint(percent);
    step('Đang đánh thức tổ mèo…', 6);
    window.setTimeout(hintSlowNetwork, SLOW_HINT_AFTER);
  }

  CatChatApp.bootScreen = {
    step,
    finish,
    fail,
    get percent() { return percent; },
    get visible() { return Boolean(screen) && !closed; }
  };
})();
