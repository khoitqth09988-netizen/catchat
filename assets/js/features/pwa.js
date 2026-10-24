/* CatChat · Đăng ký Service Worker + manifest (PWA).
   - Chỉ đăng ký khi chạy https (hoặc localhost) — GitHub Pages và Firebase Hosting đều đạt.
   - Không chặn khởi động: nếu trình duyệt không hỗ trợ thì bỏ qua êm.
   - Cập nhật ngầm: khi có bản mới, Service Worker tự skipWaiting; lần mở sau là bản mới. */
'use strict';

(function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  const secure = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
  if (!secure) return;

  window.addEventListener('load', () => {
    const scope = new URL('./', location.href);
    navigator.serviceWorker.register(new URL('sw.js', scope).href, { scope: scope.pathname })
      .then((registration) => {
        // Kiểm tra bản mới mỗi giờ (tab mở lâu), và khi tab được focus lại.
        const check = () => { registration.update().catch(() => {}); };
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch((error) => console.warn('Không đăng ký được Service Worker:', error));
  });
})();
