/* CatChat · Feature: khung nhìn (viewport) cho điện thoại & khi thu nhỏ cửa sổ.
   Vì sao cần:
     • Trên điện thoại, 100dvh không co theo bàn phím ảo → ô soạn tin bị bàn phím
       che, người dùng phải cuộn tay mới thấy chữ mình đang gõ.
     • Khi thu nhỏ cửa sổ (hoặc xoay ngang), ngăn kéo thành viên đang mở không được
       đóng lại, ô emote treo lơ lửng sai vị trí, và khung tin nhắn bị “trôi” khỏi
       tin mới nhất dù trước đó đang ở cuối.
     • Vùng an toàn (tai thỏ / vạch home) chỉ đọc được bằng env(); JS đặt chiều cao
       thật để CSS biết khi nào thanh điều hướng phải nhường chỗ.

   Feature này không ghi dữ liệu, không cần Rules. Toàn bộ chạy bằng sự kiện
   resize / visualViewport / orientationchange, có gộp bằng requestAnimationFrame
   nên không gây giật khi kéo cửa sổ. */
'use strict';

(() => {
  const PHONE_MAX = 560;
  const TABLET_MAX = 1080;
  const KEYBOARD_MIN_INSET = 140; // px: chênh lệch đủ lớn để coi là bàn phím ảo

  const root = document.documentElement;
  let started = false;
  let lastWidth = 0;
  let lastHeight = 0;
  let breakpoint = '';
  let keyboardOpen = false;
  let frame = 0;
  let settleTimer = 0;

  const byId = (id) => document.getElementById(id);

  function breakpointOf(width) {
    if (width <= PHONE_MAX) return 'phone';
    if (width <= TABLET_MAX) return 'tablet';
    return 'desktop';
  }

  function appVisible() {
    const view = byId('appView');
    return Boolean(view && !view.hidden);
  }

  /** Chiều cao thật sự còn thấy được (đã trừ bàn phím ảo nếu có). */
  function visibleHeight() {
    const vv = window.visualViewport;
    const value = vv ? vv.height : window.innerHeight;
    return Number.isFinite(value) && value > 0 ? Math.round(value) : window.innerHeight;
  }

  function keyboardInset() {
    const vv = window.visualViewport;
    if (!vv) return 0;
    return Math.max(0, Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0)));
  }

  /** Đưa khung tin nhắn về cuối nếu người dùng đang ở gần cuối trước khi đổi kích thước. */
  function keepLatestInView() {
    if (!appVisible()) return;
    if (typeof messagesNearBottom !== 'function' || typeof jumpToLatestMessages !== 'function') return;
    if (!messagesNearBottom(200)) return;
    jumpToLatestMessages(false);
  }

  /**
   * Đóng những lớp chỉ tồn tại ở bố cục hẹp khi cửa sổ đổi mức:
   * ngăn kéo thành viên, bảng emote, và trả lại focus cho ô soạn tin.
   */
  function closeNarrowLayers(reason) {
    const panel = byId('membersPanel');
    if (panel && panel.classList.contains('open')) {
      panel.classList.remove('open');
      byId('mobileMembersButton')?.setAttribute('aria-expanded', 'false');
    }
    const popover = byId('emojiPopover');
    if (popover && !popover.hidden && typeof setEmojiPickerOpen === 'function') setEmojiPickerOpen(false);
    document.dispatchEvent(new CustomEvent('catchat:viewport-change', {
      detail: { breakpoint, width: window.innerWidth, height: visibleHeight(), keyboard: keyboardOpen, reason }
    }));
  }

  function applyHeight() {
    const height = visibleHeight();
    if (Math.abs(height - lastHeight) >= 2 || !lastHeight) {
      lastHeight = height;
      root.style.setProperty('--app-vh', `${height}px`);
    }
    const inset = keyboardInset();
    const nextKeyboard = inset >= KEYBOARD_MIN_INSET && window.innerWidth <= 1024;
    if (nextKeyboard !== keyboardOpen) {
      keyboardOpen = nextKeyboard;
      root.classList.toggle('is-keyboard-open', keyboardOpen);
      root.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
      // Bàn phím vừa mở/đóng: giữ tin mới nhất trong tầm mắt.
      window.setTimeout(keepLatestInView, 60);
    }
    return height;
  }

  function sync(reason) {
    const width = window.innerWidth;
    const height = applyHeight();
    if (width !== lastWidth) {
      lastWidth = width;
      const next = breakpointOf(width);
      if (next !== breakpoint) {
        const previous = breakpoint;
        breakpoint = next;
        root.dataset.breakpoint = next;
        closeNarrowLayers(reason, previous);
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(keepLatestInView, 120);
      }
    }
    return { width, height };
  }

  function onViewportEvent(reason) {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      sync(reason);
    });
  }

  function start() {
    if (started) return;
    started = true;
    lastWidth = window.innerWidth;
    breakpoint = breakpointOf(lastWidth);
    root.dataset.breakpoint = breakpoint;
    sync('start');

    window.addEventListener('resize', () => onViewportEvent('resize'), { passive: true });
    window.addEventListener('orientationchange', () => {
      // iOS cập nhật kích thước sau khi xoay xong một nhịp.
      window.setTimeout(() => onViewportEvent('orientation'), 220);
    }, { passive: true });
    // iOS: bàn phím ảo chỉ báo qua visualViewport.
    window.visualViewport?.addEventListener('resize', () => onViewportEvent('visual-viewport'), { passive: true });
    window.visualViewport?.addEventListener('scroll', () => onViewportEvent('visual-viewport'), { passive: true });
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      // Quay lại từ bfcache: chiều cao và trạng thái kết nối có thể đã cũ.
      sync('pageshow');
      window.CatChat?.presence?.touch?.();
    });
    window.addEventListener('catchat:viewport-sync', () => onViewportEvent('manual'));
  }

  window.CatChat = window.CatChat || {};
  window.CatChat.viewport = {
    start,
    sync: () => sync('manual'),
    breakpoint: () => breakpoint,
    isPhone: () => breakpoint === 'phone',
    isMobile: () => breakpoint !== 'desktop',
    width: () => window.innerWidth,
    height: () => visibleHeight(),
    isKeyboardOpen: () => keyboardOpen,
    /** Thanh điều hướng dưới đáy có đang chiếm chỗ không (điện thoại & bàn phím đóng). */
    hasBottomBar: () => breakpoint === 'phone' && !keyboardOpen
  };

  window.CatChat.features.register({
    id: 'viewport',
    name: 'Khung nhìn linh hoạt',
    description: 'Co giãn theo bàn phím ảo, vùng an toàn và khi thu nhỏ cửa sổ.',
    start() {
      start();
    }
  });
})();
