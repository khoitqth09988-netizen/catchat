/* CatChat · Màn hình chờ (splash) có tiến trình thật — thiết kế cho MẠNG YẾU.
   API cho các file khác:
     CatChat.bootScreen.step('Đang kết nối…', 40)   cập nhật nhãn + phần trăm
     CatChat.bootScreen.finish()                    đóng splash và mở app
     CatChat.bootScreen.fail('...')                 hiện lỗi + nút thử lại
     CatChat.bootScreen.hint('...')                 dòng gợi ý nhỏ dưới thanh tiến trình
     CatChat.bootScreen.diagnose()                  đoán nguyên nhân khi bị treo

   Ba điều người dùng mạng yếu cần, và cách tệp này lo:
     1. “Thanh tiến trình phải nhúc nhích” — nếu chỉ nhảy theo từng bước thì mỗi lần
        mạng khựng lại, thanh đứng im và người dùng tưởng app treo ⇒ có nhịp tự
        nhích 1%/0.7 giây, không bao giờ vượt quá bước đang chờ.
     2. “Phải biết đang chờ cái gì, chờ bao lâu” — sau 6 giây hiện dòng gợi ý kèm số
        giây đang chờ; sau 20 giây hiện hộp lỗi có nút Thử lại nhưng VẪN tiếp tục chờ
        (mạng chậm mà cuối cùng vào được thì app vẫn mở, hộp lỗi tự ẩn đi).
     3. “Đừng để tôi đoán” — diagnose() chỉ ra đúng nguyên nhân thường gặp: ngoại
        tuyến, CSP/tiện ích chặn Firebase, chưa tải được SDK, hay máy chủ im lặng.

   Mốc thời gian có thể ghi đè khi kiểm thử: window.__catchatBootLimits = { hint, warn }.
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
  const EXIT_MS = prefersReducedMotion() ? 30 : 500;
  const startedAt = Date.now();
  const limits = () => Object.assign(
    { hint: 6000, warn: 20000, creep: 700 },
    (typeof window.__catchatBootLimits === 'object' && window.__catchatBootLimits) || {}
  );

  let screen = null;
  let bar = null;
  let fill = null;
  let hintEl = null;
  let stepEl = null;
  let errorBox = null;
  let errorText = null;
  let percent = 6;
  let ceiling = 96;
  let closed = false;
  let hintedSlow = false;
  let warned = false;
  let swapTimer = null;
  let closeTimer = null;
  let creepTimer = 0;
  let clockTimer = 0;

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
    hintEl = pick('bootHint');
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
    if (typeof nextPercent === 'number') {
      paint(nextPercent);
      // Nhịp tự nhích chỉ được tiến tới sát bước đang chờ, không vượt qua nó —
      // nhờ vậy thanh tiến trình “sống” mà vẫn trung thực.
      ceiling = Math.max(percent, Math.min(96, Math.round(nextPercent) + 1));
    }
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
  function stopClocks() {
    window.clearInterval(creepTimer);
    window.clearInterval(clockTimer);
    creepTimer = 0;
    clockTimer = 0;
  }

  function finish() {
    if (closed) return;
    closed = true;
    stopClocks();
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

  /** Dòng gợi ý nhỏ (không phải lỗi) — dùng khi mạng chậm. */
  function hint(text) {
    if (!ensure()) return;
    if (!hintEl) return;
    const value = String(text || '').trim();
    hintEl.hidden = !value;
    if (value) hintEl.textContent = value;
  }

  /** Đoán nguyên nhân khi splash đứng lâu — chỉ đọc trạng thái, không gọi mạng. */
  function diagnose() {
    if (window.navigator && window.navigator.onLine === false) {
      return 'Thiết bị đang ngoại tuyến. Hãy bật Wi-Fi/4G rồi bấm “Thử lại”.';
    }
    if (window.CatChatEarlyGuard?.isCspBlocked?.() === true) {
      return 'Trình duyệt hoặc tiện ích đang chặn kết nối tới máy chủ dữ liệu của Firebase. '
        + 'Hãy tắt trình chặn quảng cáo cho trang này rồi bấm “Thử lại”.';
    }
    if (!window.firebase) {
      return 'Chưa tải được thư viện Firebase (www.gstatic.com). Mạng đang rất chậm hoặc bị chặn — '
        + 'hãy thử Wi-Fi khác rồi bấm “Thử lại”.';
    }
    if (window.firebase?.database) {
      return 'Máy chủ chưa phản hồi kịp. Mạng yếu thường chỉ cần thêm vài giây; '
        + 'nếu đã quá lâu, hãy bấm “Thử lại”.';
    }
    return 'Chưa mở được CatChat. Hãy kiểm tra kết nối rồi bấm “Thử lại”.';
  }

  const secondsWaiting = () => Math.max(0, Math.round((Date.now() - startedAt) / 1000));

  /** Mạng chậm: nhắc nhẹ, KHÔNG chặn — app vẫn tiếp tục tải. */
  function noteSlowNetwork() {
    if (closed || hintedSlow) return;
    hintedSlow = true;
    if (screen && !screen.classList.contains('is-failed')) screen.classList.add('is-slow');
    hint(`Mạng hơi chậm — vẫn đang kết nối (${secondsWaiting()} giây). Bạn không cần làm gì cả.`);
  }

  /** Quá lâu: hiện lỗi + nút Thử lại nhưng vẫn tiếp tục chờ mạng. */
  function warnTooLong() {
    if (closed || warned) return;
    warned = true;
    revealFailure(`Vẫn chưa mở được sau ${secondsWaiting()} giây. ${diagnose()}`);
  }

  /** Hiện hộp lỗi mà KHÔNG đóng splash (vẫn có thể tải xong và tự ẩn). */
  function revealFailure(message) {
    if (!ensure()) return;
    screen.classList.add('is-failed');
    if (errorBox) errorBox.hidden = false;
    if (errorText) errorText.textContent = String(message || diagnose());
    const retry = pick('bootRetry');
    if (retry && !screen.dataset.retryFocused) {
      screen.dataset.retryFocused = '1';
      retry.focus({ preventScroll: true });
    }
  }

  /* Nhịp tự nhích: chỉ chạy khi splash còn hiện. */
  function startClocks() {
    const { hint: hintAfter, warn: warnAfter, creep } = limits();
    creepTimer = window.setInterval(() => {
      if (closed) return;
      if (percent < ceiling) paint(percent + 1);
    }, Math.max(200, Number(creep) || 700));
    clockTimer = window.setInterval(() => {
      if (closed) return;
      if (!hintedSlow && secondsWaiting() * 1000 >= hintAfter) noteSlowNetwork();
      else if (hintedSlow && !warned) {
        // Cập nhật số giây để người dùng thấy app vẫn đang chạy, không phải treo.
        hint(`Mạng hơi chậm — vẫn đang kết nối (${secondsWaiting()} giây). Bạn không cần làm gì cả.`);
      }
      if (secondsWaiting() * 1000 >= warnAfter) warnTooLong();
    }, 1000);
  }

  if (ensure()) {
    paint(percent);
    step('Đang đánh thức tổ mèo…', 6);
    startClocks();
    if (window.navigator && window.navigator.onLine === false) {
      revealFailure('Thiết bị đang ngoại tuyến. Hãy bật Wi-Fi/4G rồi bấm “Thử lại”.');
    }
    window.addEventListener('offline', () => revealFailure('Thiết bị vừa mất mạng. Hãy kiểm tra Wi-Fi/4G rồi bấm “Thử lại”.'));
  }

  CatChatApp.bootScreen = {
    step,
    finish,
    fail,
    hint,
    diagnose,
    elapsed: secondsWaiting,
    get percent() { return percent; },
    get visible() { return Boolean(screen) && !closed; }
  };
})();
