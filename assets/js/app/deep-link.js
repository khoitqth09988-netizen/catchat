/* CatChat · Deep link cho lối tắt PWA (`manifest.webmanifest → shortcuts`).
   Khi cài CatChat lên màn hình chính, bấm giữ biểu tượng sẽ thấy các lối tắt:
     · ?view=chat           → mở khung trò chuyện (mặc định)
     · ?view=members        → mở danh bạ thành viên
     · ?view=announcements  → mở phòng thông báo toàn máy chủ
   Trước đây các lối tắt trỏ tới tham số `view` nhưng không ai đọc ⇒ bấm vào chỉ mở
   trang như thường.

   Vì sao phải "thử lại + xác nhận":
     – #appView hiện ra TRƯỚC khi có messagesRef, nên thao tác sớm sẽ bị bỏ qua;
     – ngay sau khi đăng nhập, app còn tự switchChannel('general'), mà switchChannel
       thoát chế độ thông báo ⇒ vừa mở xong đã bị đóng lại.
   Nên: chờ sự kiện 'catchat:workspace-ready', áp dụng, rồi kiểm tra lại sau 400ms;
   nếu trạng thái bị mất thì thử lại (tối đa 5 lần, ~2 giây).

   Không thêm node Firebase, không đổi quyền ⇒ Rules không cần sửa. */
'use strict';

(() => {
  const MAX_ATTEMPTS = 5;
  const RETRY_DELAY = 150;
  const VERIFY_DELAY = 400;

  const applied = () => ({
    chat: () => true,
    members: () => workspaceView === 'members',
    announcements: () => announcementMode === true
  });

  // Trả về true khi thao tác đã chạy xong (chưa chắc đã "dính", sẽ xác nhận sau).
  const actions = {
    chat: () => {
      setWorkspaceView('chat');
      return true;
    },
    members: () => {
      setWorkspaceView('members');
      return true;
    },
    announcements: () => {
      setWorkspaceView('chat');
      if (announcementMode) return true;
      if (activeChannelId !== 'general') return false;
      const button = document.getElementById('channelAnnouncements');
      if (!button) return false;
      button.click();
      return true;
    }
  };

  let settled = false;
  let observer = null;
  let pendingView = '';

  function requestedView() {
    try {
      const value = new URLSearchParams(window.location.search).get('view');
      return value && Object.prototype.hasOwnProperty.call(actions, value) ? value : '';
    } catch (error) {
      return '';
    }
  }

  function cleanUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('view')) return;
      url.searchParams.delete('view');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      // Trình duyệt chặn replaceState (file://) — chỉ còn tham số thừa, không sao.
    }
  }

  function finish(view) {
    settled = true;
    cleanUrl();
    observer?.disconnect();
    observer = null;
    // Thông báo cho phần khác (nếu cần) rằng lối tắt đã xử lý xong.
    let ok = false;
    try { ok = applied()[view](); } catch (error) { ok = false; }
    try {
      window.dispatchEvent(new CustomEvent('catchat:deeplink-applied', { detail: { view, ok } }));
    } catch (error) { /* bỏ qua */ }
  }

  function attempt(view, round = 0) {
    if (settled) return;
    let done = false;
    try {
      done = actions[view]() !== false;
    } catch (error) {
      console.warn('Không mở được lối tắt:', error);
      done = true;
    }
    if (!done) {
      if (round < MAX_ATTEMPTS) window.setTimeout(() => attempt(view, round + 1), RETRY_DELAY);
      else finish(view);
      return;
    }
    // Xác nhận: app có thể vừa switchChannel và tự tắt chế độ thông báo.
    window.setTimeout(() => {
      if (settled) return;
      let stillApplied = false;
      try { stillApplied = applied()[view](); } catch (error) { stillApplied = false; }
      if (stillApplied) {
        finish(view);
      } else if (round < MAX_ATTEMPTS) {
        attempt(view, round + 1);
      } else {
        finish(view);
      }
    }, VERIFY_DELAY);
  }

  function boot() {
    const view = requestedView();
    if (!view) return;
    pendingView = view;
    // enterWorkspace phát sự kiện này sau khi đã dựng xong listener dữ liệu.
    window.addEventListener('catchat:workspace-ready', () => attempt(view), { once: true });
    const appView = document.getElementById('appView');
    if (!appView) return;
    // Dự phòng khi bản đang cache chưa phát sự kiện: chỉ áp dụng khi đã có messagesRef.
    const ready = () => !appView.hidden && typeof messagesRef !== 'undefined' && Boolean(messagesRef);
    observer = new MutationObserver(() => {
      if (ready()) attempt(view);
    });
    observer.observe(appView, { attributes: true, attributeFilter: ['hidden'] });
  }

  window.CatChatDeepLink = {
    requestedView,
    /** Dùng trong test: áp lối tắt ngay, không chờ sự kiện. */
    apply(view = requestedView()) {
      if (!view || !Object.prototype.hasOwnProperty.call(actions, view)) return false;
      attempt(view);
      return true;
    },
    isPending: () => Boolean(pendingView) && !settled
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
