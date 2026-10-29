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

  /** Ưu tiên API của boot-screen.js khi đã có (thông điệp thống nhất một chỗ). */
  function showFailure(message, stepLabel) {
    const screenApi = window.CatChat?.bootScreen;
    if (screenApi && typeof screenApi.fail === 'function' && byId('bootScreen')) {
      screenApi.fail(message);
      return;
    }
    revealError(message, stepLabel);
  }

  window.setTimeout(() => {
    if (booted() || window.firebase) return;
    showFailure(
      'Mạng có vẻ quá chậm, hoặc đang chặn www.gstatic.com (nơi chứa Firebase SDK). '
      + 'Hãy kiểm tra kết nối rồi bấm “Thử lại”.',
      'Đang chờ mạng tải thư viện…'
    );
  }, FIREBASE_HINT_MS);

  window.setTimeout(() => {
    if (booted()) return;
    showFailure(
      'Chưa mở được CatChat sau 18 giây. Nếu mạng đang yếu, hãy đợi thêm một chút hoặc bấm “Thử lại”.',
      'Kết nối quá chậm'
    );
  }, GIVE_UP_MS);

  /* ── Chẩn đoán: trình duyệt/tiện ích chặn script từ host Realtime Database ──
     Khi WebSocket bị chặn (mạng 3G/4G chập chờn, proxy công ty, VPN, DNS lọc) thì
     Firebase RTDB tự chuyển sang long-polling bằng JSONP — tức là tải một <script>
     từ chính host database (`https://<db>.firebaseio.com/.lp?...`). Nếu CSP hoặc
     tiện ích chặn script đó, app không đồng bộ được gì mà chỉ có console nói lý do.
     Ở đây ghi lại vi phạm và báo bằng tiếng Việt, kèm nhãn kết nối đổi thành
     “Bị chặn kết nối” (theme.js đọc lại qua isCspBlocked()). */
  // Host dữ liệu Firebase: <db>.firebaseio.com (tên cũ) và <db>.<region>.firebasedatabase.app.
  const DATA_HOSTS = ['firebaseio.com', 'firebasedatabase.app'];
  const isDataHost = (host) => DATA_HOSTS.some((suffix) => host === suffix || host.endsWith('.' + suffix));
  const violations = [];
  let dataBlocked = false;
  let blockedUri = '';
  let notified = false;
  let retryTimer = 0;

  function hostOf(uri) {
    try {
      return new URL(uri, window.location.href).hostname;
    } catch (_) {
      return '';
    }
  }

  function explainBlock(message) {
    const pill = byId('connectionPill');
    const label = byId('connectionLabel');
    if (pill && pill.classList.contains('online')) return;
    if (label) label.textContent = 'Bị chặn kết nối';
    if (pill && message) pill.title = message;
  }

  function notifyBlocked() {
    if (notified) return;
    const hint = 'Không đồng bộ được dữ liệu vì trình duyệt hoặc tiện ích đang chặn script từ '
      + (blockedUri || 'host Firebase') + '. Hãy tắt trình chặn quảng cáo/CSP của tiện ích rồi tải lại trang.';
    // Toast chỉ có sau khi app lắp xong; nếu chưa có thì thử lại mỗi giây (tối đa 20 lần).
    if (typeof window.toast !== 'function') {
      if (!retryTimer) {
        let tries = 0;
        retryTimer = window.setInterval(() => {
          tries += 1;
          notifyBlocked();
          if (notified || tries >= 20) {
            window.clearInterval(retryTimer);
            retryTimer = 0;
          }
        }, 1000);
      }
      return;
    }
    notified = true;
    if (retryTimer) {
      window.clearInterval(retryTimer);
      retryTimer = 0;
    }
    window.toast(hint, 'error');
    explainBlock(hint);
  }

  if (typeof document.addEventListener === 'function') {
    // Gắn vô điều kiện: trình duyệt không hỗ trợ sự kiện này thì đơn giản là không có gì xảy ra.
    document.addEventListener('securitypolicyviolation', (event) => {
      const uri = String(event.blockedURI || '');
      const directive = String(event.effectiveDirective || event.violatedDirective || '');
      violations.push({ uri, directive });
      if (violations.length > 20) violations.shift();
      if (!/^script-src/.test(directive)) return;
      if (!isDataHost(hostOf(uri))) return;
      dataBlocked = true;
      blockedUri = uri;
      notifyBlocked();
    });
  }

  // Dùng lại từ events.js khi thiếu Firebase SDK (cùng một thông điệp, một chỗ sửa).
  window.CatChatEarlyGuard = {
    revealError,
    isBooted: booted,
    isCspBlocked: () => dataBlocked,
    cspViolations: () => violations.slice()
  };
})();
