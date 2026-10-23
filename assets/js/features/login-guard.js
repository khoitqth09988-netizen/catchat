/* CatChat · Feature: chặn dò mật khẩu (brute-force) ở phía máy khách.
   - Giới hạn 5 lần đăng nhập / 60 giây.
   - Sai liên tiếp sẽ bị khoá tạm thời, mức khoá tăng dần và ghi vào localStorage
     để tải lại trang cũng không xoá được ngay.
   - Không thay thế được Firebase Auth quota + App Check, nhưng chặn được script
     thử mật khẩu liên tục từ một trình duyệt. */
'use strict';

(() => {
  const STORAGE_KEY = 'catchat-login-guard-v1';
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 60000;
  const LOCK_STEPS = [60000, 120000, 300000, 900000, 1800000];

  let state = { attempts: [], lockUntil: 0, strikes: 0 };
  let ticker = null;

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts.filter((value) => Number.isFinite(value)) : [],
        lockUntil: Number(parsed.lockUntil) || 0,
        strikes: Number(parsed.strikes) || 0
      };
    } catch (error) {
      return { attempts: [], lockUntil: 0, strikes: 0 };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Chế độ riêng tư: chỉ giữ trong bộ nhớ.
    }
  }

  function remainingMs() {
    return Math.max(0, state.lockUntil - Date.now());
  }

  function formatMs(ms) {
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    if (seconds < 60) return `${seconds} giây`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} phút`;
  }

  function refreshNotice() {
    const left = remainingMs();
    if (!left) {
      window.clearInterval(ticker);
      ticker = null;
      if (els.authError && els.authErrorText?.textContent.startsWith('Tạm khoá đăng nhập')) setAuthError('');
      return;
    }
    setAuthError(`Tạm khoá đăng nhập còn ${formatMs(left)} vì thử quá nhiều lần. Hãy chờ hoặc dùng "Quên mật khẩu".`);
  }

  function startTicker() {
    if (ticker) return;
    ticker = window.setInterval(refreshNotice, 1000);
    refreshNotice();
  }

  function isLocked() {
    return remainingMs() > 0;
  }

  function registerAttempt() {
    const time = Date.now();
    state.attempts = [...state.attempts.filter((value) => time - value < WINDOW_MS), time];
    if (state.attempts.length > MAX_ATTEMPTS) {
      const step = LOCK_STEPS[Math.min(state.strikes, LOCK_STEPS.length - 1)];
      state.strikes += 1;
      state.lockUntil = time + step;
      state.attempts = [];
      save();
      startTicker();
      refreshNotice();
      return true;
    }
    save();
    return false;
  }

  function resetAttempts() {
    if (!state.attempts.length && !state.lockUntil) return;
    state.attempts = [];
    save();
  }

  CatChat.features.register({
    id: 'login-guard',
    name: 'Giới hạn đăng nhập',
    description: 'Chặn thử mật khẩu liên tục: tối đa 5 lần/phút, khoá tạm thời tăng dần.',
    start() {
      state = load();
      if (isLocked()) startTicker();
      // Bắt ở pha capture để có thể chặn trước khi submitAuth chạy.
      document.addEventListener('submit', (event) => {
        if (event.target !== els.authForm) return;
        if (isLocked()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          refreshNotice();
          return;
        }
        if (registerAttempt()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setAuthError(`Bạn đã thử ${MAX_ATTEMPTS + 1} lần trong 1 phút. Tạm khoá đăng nhập ${formatMs(remainingMs())}.`);
          return;
        }
        // Đăng nhập thành công thì auth state đổi; xoá bộ đếm sau 2 giây nếu không còn lỗi.
        window.setTimeout(() => {
          if (currentUser) resetAttempts();
        }, 2000);
      }, true);
    },
    keydown() {
      return false;
    }
  });
})();
