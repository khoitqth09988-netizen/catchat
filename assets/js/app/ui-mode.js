/* CatChat · Chọn giao diện theo thiết bị (chạy trước lần vẽ đầu tiên).
   Tệp này được nạp ngay trong <head> (không defer) và chỉ làm một việc: gắn
   data-ui="mobile" hoặc data-ui="desktop" lên <html>. Nhờ vậy điện thoại nhận
   giao diện app riêng (assets/css/mobile-app.css) ngay từ khung hình đầu, không
   bị nhấp nháy đổi bố cục; máy tính giữ nguyên giao diện cũ vì mọi luật trong
   mobile-app.css đều bắt đầu bằng html[data-ui="mobile"].

   Quy tắc nhận diện:
     · màn hình hẹp ≤ 760px .................. điện thoại (kể cả khi thu nhỏ cửa sổ)
     · con trỏ chính là cảm ứng, ≤ 1024px .... máy tính bảng
     · có điểm chạm, ≤ 820px ................. máy lai / iPad mini
   Có thể ép thử bằng ?ui=mobile hoặc ?ui=desktop (hữu ích khi kiểm tra). */
'use strict';

(() => {
  const MOBILE_WIDTH = 760;
  const TOUCH_TABLET_WIDTH = 1024;
  const TOUCH_SMALL_WIDTH = 820;

  function forcedMode(win) {
    try {
      const value = new URLSearchParams(win.location?.search || '').get('ui');
      return value === 'mobile' || value === 'desktop' ? value : '';
    } catch (error) {
      return '';
    }
  }

  function detect(win) {
    const forced = forcedMode(win);
    if (forced) return forced;

    const width = Number(win.innerWidth) || 0;
    const match = (query) => {
      try {
        return typeof win.matchMedia === 'function' && win.matchMedia(query).matches;
      } catch (error) {
        return false;
      }
    };

    if (match(`(max-width: ${MOBILE_WIDTH}px)`)) return 'mobile';
    if (match('(pointer: coarse)') && width <= TOUCH_TABLET_WIDTH) return 'mobile';
    const touchPoints = Number(win.navigator?.maxTouchPoints) || 0;
    if (touchPoints > 0 && width <= TOUCH_SMALL_WIDTH) return 'mobile';
    return 'desktop';
  }

  function apply(win = window) {
    const mode = detect(win);
    const root = win.document.documentElement;
    root.dataset.ui = mode;
    root.classList.toggle('ui-mobile', mode === 'mobile');
    root.classList.toggle('ui-desktop', mode === 'desktop');
    return mode;
  }

  window.CatChatUIMode = {
    detect,
    apply,
    isForced: (win = window) => Boolean(forcedMode(win)),
    widths: { MOBILE_WIDTH, TOUCH_TABLET_WIDTH, TOUCH_SMALL_WIDTH }
  };

  try {
    apply(window);
  } catch (error) {
    // Không xác định được thiết bị thì giữ giao diện máy tính — an toàn hơn.
    document.documentElement.dataset.ui = 'desktop';
  }
})();
