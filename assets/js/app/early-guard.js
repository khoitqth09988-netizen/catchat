/* CatChat · Gác cổng khởi động sớm (chạy trước cả Firebase SDK).
   Vì sao cần: index.html nạp Firebase SDK từ www.gstatic.com bằng <script defer>.
   Mọi script defer phải xếp hàng theo thứ tự, nên khi mạng rất yếu (hoặc nhà mạng
   chặn gstatic) mà một tệp SDK "treo" thì các script CatChat phía sau KHÔNG BAO GIỜ
   chạy — splash đứng im và người dùng chỉ thấy vòng chờ mãi.

   Tệp này nạp ngay trong <head> (không defer), chỉ vài KB, cùng origin nên có sẵn
   gần như tức thì (đặc biệt khi đã cài PWA vì Service Worker đã cache sẵn). Nó:
     1. Sau 9 giây: nếu chưa có window.firebase → báo đúng nguyên nhân (mạng chậm /
        bị chặn gstatic) ngay trên splash.
     2. Sau 18 giây: nếu app vẫn chưa mở (body chưa có class "booted") → hiện hộp lỗi
        + nút "Thử lại" để người dùng không phải tự tải lại trang.
     3. Nút "Thử lại" của splash luôn bấm được (kể cả trước khi boot-screen.js chạy).

   Không ghi dữ liệu, không cần Rules, không dùng script/handler nội tuyến (CSP-safe). */
'use strict';

(() => {
  const FIREBASE_HINT_MS = 9000;
  const GIVE_UP_MS = 18000;

  const byId = (id) => document.getElementById(id);
  const booted = () => Boolean(document.body) && document.body.classList.contains('booted');

  function revealError(message, stepLabel) {
    if (booted()) return false;
    const screen = byId('bootScreen');
    if (!screen) return false;
    screen.classList.add('is-failed');
    const box = byId('bootError');
    if (box) box.hidden = false;
    const text = byId('bootErrorText');
    if (text && message) text.textContent = message;
    const step = byId('bootStep');
    if (step && stepLabel) step.textContent = stepLabel;
    const retry = byId('bootRetry');
    if (retry) {
      retry.hidden = false;
      // Dùng chung cờ với boot-screen.js để không gắn hai lần một handler.
      if (!retry.dataset.bound) {
        retry.dataset.bound = '1';
        retry.addEventListener('click', () => window.location.reload());
      }
    }
    return true;
  }

  window.setTimeout(() => {
    if (booted() || window.firebase) return;
    revealError(
      'Mạng có vẻ quá chậm, hoặc đang chặn www.gstatic.com (nơi chứa Firebase SDK). '
      + 'Hãy kiểm tra kết nối rồi bấm “Thử lại”.',
      'Đang chờ mạng tải thư viện…'
    );
  }, FIREBASE_HINT_MS);

  window.setTimeout(() => {
    if (booted()) return;
    revealError(
      'Chưa mở được CatChat sau 18 giây. Nếu mạng đang yếu, hãy đợi thêm một chút hoặc bấm “Thử lại”.',
      'Kết nối quá chậm'
    );
  }, GIVE_UP_MS);

  // Dùng lại từ events.js khi thiếu Firebase SDK (cùng một thông điệp, một chỗ sửa).
  window.CatChatEarlyGuard = {
    revealError,
    isBooted: booted
  };
})();
