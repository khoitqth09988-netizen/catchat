/* CatChat · Firebase App Check (tuỳ chọn, khuyến nghị bật khi chạy thật).
   App Check xác thực rằng request đến từ chính app của bạn, nhờ đó chặn được
   bot/script lạ spam Realtime Database và Storage — đây mới là lớp chống lạm dụng
   thực sự ở phía hạ tầng, khác với giới hạn tần suất chỉ chạy trong trình duyệt.

   Cách bật:
   1. Vào Firebase Console → App Check → đăng ký app web với reCAPTCHA v3, lấy site key.
   2. Điền site key vào `appCheckSiteKey` trong assets/js/app/config.js.
   3. (Sau khi kiểm tra log) bật Enforcement cho Realtime Database và Storage.
   Khi chưa điền site key, file này không làm gì cả — app chạy y như trước. */
'use strict';

window.appCheckReady = (async () => {
  const siteKey = String(firebaseConfig?.appCheckSiteKey || '').trim();
  if (!siteKey) return null;
  if (!window.firebase) return null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Không tải được ${src}`));
      document.head.appendChild(script);
    });
  }

  try {
    if (!window.firebase.appCheck) {
      await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js');
    }
    if (!window.firebase.appCheck) {
      console.warn('Firebase App Check SDK không khả dụng — bỏ qua lớp xác thực thiết bị.');
      return null;
    }
    const appCheck = firebase.appCheck();
    const Provider = window.firebase.appCheck.ReCaptchaV3Provider;
    if (Provider) {
      appCheck.activate(new Provider(siteKey), true);
    } else {
      // Compat SDK cũ hơn: truyền thẳng site key (mặc định dùng reCAPTCHA v3).
      appCheck.activate(siteKey, true);
    }
    console.info('CatChat: đã bật Firebase App Check (reCAPTCHA v3).');
    return appCheck;
  } catch (error) {
    console.warn('Không bật được Firebase App Check:', error);
    return null;
  }
})();
