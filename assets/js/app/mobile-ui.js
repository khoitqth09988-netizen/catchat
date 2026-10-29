/* CatChat · Điều khiển giao diện app dành riêng cho điện thoại.
   ui-mode.js đã chọn html[data-ui="mobile"] | "desktop" và mobile-app.css lo phần
   bố cục. Tệp này chỉ nối các nút mới với hành vi cũ, không viết lại tính năng:
     · tab Kênh     → mở/đóng ngăn kéo (#sidebar gốc)
     · tab Trò chuyện → bấm #navChat (chuyển về khung chat)
     · tab Thành viên → bấm #navMembers (danh bạ toàn màn hình)
     · tab Cài đặt  → bảng trượt đáy, gọi lại đúng các nút có sẵn
                       (Giao diện, Quản trị, Đã lưu, Thông báo, Miu, Đăng xuất)
   Ngăn kéo kênh có thêm: nút ✕, ô lọc kênh (không phân biệt dấu), vuốt trái để đóng,
   Esc / nút Back của Android để đóng, và trả focus về nút đã bấm trước đó.
   Máy tính không chạy gì ở đây: mọi hàm đều thoát sớm khi data-ui != "mobile". */
'use strict';

(() => {
  const SHEETS = ['channels', 'settings'];
  const root = document.documentElement;
  const q = (selector) => document.querySelector(selector);

  let scrim = null;
  let tabbar = null;
  let settingsSheet = null;
  let sidebar = null;
  let channelFilter = null;
  let channelList = null;
  let lastFocus = null;
  let historyPushed = false;
  let wired = false;
  let dragOriginX = null;
  let dragOriginY = null;

  const isMobile = () => root.dataset.ui === 'mobile';
  const currentSheet = () => (SHEETS.includes(root.dataset.mobileSheet) ? root.dataset.mobileSheet : '');

  /* ── Hiện/ẩn các phần tử của giao diện mobile ── */
  function syncChrome() {
    if (!tabbar || !scrim) return;
    if (!isMobile()) {
      closeSheet({ silent: true, keepFocus: true });
      tabbar.hidden = true;
      scrim.hidden = true;
      return;
    }
    const appView = q('#appView');
    const loggedIn = Boolean(appView && !appView.hidden);
    tabbar.hidden = !loggedIn;
    if (!loggedIn) closeSheet({ silent: true, keepFocus: true });
  }

  function syncSheetChrome() {
    const sheet = currentSheet();
    if (scrim) {
      // Không bao giờ để lớp mờ đứng một mình: nếu vì lý do gì đó (bản JS cũ còn trong
      // cache, một listener ném lỗi, trình duyệt bỏ qua một bước) lớp này còn hiện
      // trong khi không có ngăn kéo nào mở thì cả màn hình bị tối và không bấm được.
      scrim.hidden = !sheet;
      scrim.style.pointerEvents = '';
    }
    if (settingsSheet) settingsSheet.hidden = sheet !== 'settings';
    document.body.classList.toggle('mobile-sheet-open', Boolean(sheet));
    const channelTab = q('#mobileTabbar [data-mobile-tab="channels"]');
    const settingsTab = q('#mobileTabbar [data-mobile-tab="settings"]');
    if (channelTab) channelTab.setAttribute('aria-expanded', String(sheet === 'channels'));
    if (settingsTab) settingsTab.setAttribute('aria-expanded', String(sheet === 'settings'));
  }

  function openSheet(name) {
    if (!isMobile() || !SHEETS.includes(name)) return;
    if (currentSheet() === name) {
      closeSheet();
      return;
    }
    const trigger = document.activeElement;
    if (trigger instanceof HTMLElement) lastFocus = trigger;
    root.dataset.mobileSheet = name;
    syncSheetChrome();
    if (name === 'channels') applyChannelFilter();
    // Nút "back" trên Android đóng bảng trước khi rời trang.
    if (!historyPushed) {
      try {
        window.history.pushState({ catchatSheet: name }, '');
        historyPushed = true;
      } catch (error) { /* trình duyệt chặn pushState: vẫn dùng được nút đóng */ }
    }
    const first = name === 'settings'
      ? settingsSheet?.querySelector('.mobile-sheet-row:not([hidden])')
      : q('#sidebar .nav-link');
    window.setTimeout(() => first?.focus({ preventScroll: true }), 80);
  }

  /* ── Lọc kênh trong ngăn kéo ──
     Chỉ lọc danh sách đang có (không gọi Firebase) và tự áp lại khi
     renderChannelList() vẽ lại #channelList. Bỏ dấu tiếng Việt để gõ "meo"
     vẫn tìm ra "mèo-con". */
  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

  function applyChannelFilter() {
    if (!channelList) return;
    const query = normalizeText(channelFilter?.value || '');
    let matched = 0;
    channelList.querySelectorAll('.channel-link[data-channel-id]').forEach((button) => {
      const name = normalizeText(button.querySelector('.channel-name')?.textContent || button.textContent || '');
      const visible = !query || name.includes(query);
      button.hidden = !visible;
      if (visible) matched += 1;
    });
    const empty = q('#mobileChannelEmpty');
    if (empty) empty.hidden = !query || matched > 0;
  }

  function resetChannelFilter() {
    if (!channelFilter || !channelFilter.value) return;
    channelFilter.value = '';
    applyChannelFilter();
  }

  function closeSheet({ silent = false, keepFocus = false } = {}) {
    if (!currentSheet()) return false;
    if (currentSheet() === 'channels') resetChannelFilter();
    root.removeAttribute('data-mobile-sheet');
    syncSheetChrome();
    if (!keepFocus && lastFocus instanceof HTMLElement && lastFocus.isConnected) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
    if (historyPushed) {
      historyPushed = false;
      // Trả lại mục history đã đẩy khi mở bảng, kể cả khi bảng tự đóng (chọn kênh…),
      // để nút Back của Android không phải bấm thừa lần nào.
      if (window.history.state && window.history.state.catchatSheet) {
        try { window.history.back(); } catch (error) { /* không sao */ }
      }
    }
    return true;
  }

  const toggleSheet = (name) => (currentSheet() === name ? closeSheet() : openSheet(name));

  /* ── Tab dưới đáy ── */
  function setTab(tab) {
    const chatTab = q('#mobileTabbar [data-mobile-tab="chat"]');
    const memberTab = q('#mobileTabbar [data-mobile-tab="members"]');
    const members = tab === 'members';
    if (chatTab) chatTab.setAttribute('aria-current', members ? 'false' : 'page');
    if (memberTab) memberTab.setAttribute('aria-current', members ? 'page' : 'false');
  }

  function syncViewTab() {
    setTab(q('#appView')?.dataset.view === 'members' ? 'members' : 'chat');
  }

  function onTabClick(event) {
    const button = event.target instanceof Element ? event.target.closest('[data-mobile-tab]') : null;
    if (!button) return;
    const tab = button.dataset.mobileTab;
    if (tab === 'channels' || tab === 'settings') {
      toggleSheet(tab);
      return;
    }
    closeSheet({ silent: true });
    if (tab === 'members') {
      q('#navMembers')?.click();
      setTab('members');
    } else if (tab === 'chat') {
      q('#navChat')?.click();
      setTab('chat');
    }
  }

  /* ── Bảng cài đặt: gọi lại các nút có sẵn của giao diện máy tính ── */
  const SETTINGS_ACTIONS = {
    theme: '#openThemeSettingsButton',
    admin: '#openAdminButton',
    saved: '#savedMessagesButton',
    announcements: '#channelAnnouncements',
    miu: '#catCompanionButton',
    logout: '#logoutButton'
  };

  function onSettingsClick(event) {
    const row = event.target instanceof Element ? event.target.closest('[data-mobile-action]') : null;
    if (!row) return;
    const selector = SETTINGS_ACTIONS[row.dataset.mobileAction];
    if (!selector) return;
    const target = q(selector);
    closeSheet({ silent: true, keepFocus: true });
    target?.click();
  }

  function refreshSettings() {
    if (!isMobile()) return;
    const adminRow = q('#mobileSettingsSheet [data-mobile-action="admin"]');
    if (adminRow) adminRow.hidden = Boolean(q('#openAdminButton')?.hidden);
    const adminNav = q('#navAdmin');
    if (adminRow && adminNav && !adminNav.hidden) adminRow.hidden = false;

    const savedCount = q('#savedMessagesCount');
    const savedHint = q('#mobileSavedCount');
    if (savedHint) {
      const count = savedCount && !savedCount.hidden ? savedCount.textContent.trim() : '';
      savedHint.textContent = count && count !== '0' ? count : '';
    }
  }

  function mirrorConnection() {
    const pill = q('#connectionPill');
    const label = q('#connectionLabel');
    const dot = q('#mobileConnectionDot');
    const text = q('#mobileConnectionLabel');
    if (!pill || !dot || !text) return;
    dot.classList.toggle('online', pill.classList.contains('online'));
    dot.classList.toggle('offline', pill.classList.contains('offline'));
    text.textContent = label?.textContent?.trim() || 'Đang kết nối';
  }

  /* ── Vuốt ngang để đóng ngăn kéo (điện thoại) ──
     Kéo sang trái ≥ 64px là đóng; kéo ít hơn thì ngăn kéo trở về chỗ cũ.
     Dùng pointer events nên chuột trên máy tính cũng không bị ảnh hưởng. */
  function attachDrawerSwipe() {
    if (!sidebar) return;
    const reset = () => {
      dragOriginX = null;
      dragOriginY = null;
      sidebar.classList.remove('is-dragging');
      sidebar.style.transform = '';
    };
    const finish = (event) => {
      if (dragOriginX === null) return;
      const dx = (event.clientX ?? dragOriginX) - dragOriginX;
      reset();
      if (dx <= -64) closeSheet();
    };
    sidebar.addEventListener('pointerdown', (event) => {
      if (currentSheet() !== 'channels' || event.pointerType === 'mouse') return;
      if (event.button > 0) return;
      dragOriginX = event.clientX;
      dragOriginY = event.clientY;
      // Giữ mọi sự kiện của ngón tay này trên ngăn kéo, kể cả khi ngón tay đã
      // trượt ra ngoài mép trái (nếu không, pointerup rơi vào lớp mờ/body và
      // ngăn kéo bị kẹt ở vị trí đang kéo).
      try { sidebar.setPointerCapture?.(event.pointerId); } catch (error) { /* trình duyệt cũ */ }
    });
    sidebar.addEventListener('pointermove', (event) => {
      if (dragOriginX === null) return;
      const dx = Math.min(0, event.clientX - dragOriginX);
      const dy = Math.abs(event.clientY - (dragOriginY ?? event.clientY));
      // Cuộn dọc trong danh sách kênh không được kéo ngăn kéo xê dịch.
      if (Math.abs(dx) < 8 || Math.abs(dx) < dy) return;
      sidebar.classList.add('is-dragging');
      sidebar.style.transform = `translateX(${dx}px)`;
    });
    sidebar.addEventListener('pointerup', finish);
    sidebar.addEventListener('pointercancel', reset);
    // Dự phòng: một số trình duyệt không hỗ trợ pointer capture hoặc huỷ capture
    // giữa chừng ⇒ vẫn kết thúc thao tác kéo khi ngón tay nhấc lên ở nơi khác.
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', reset);
  }

  /* ── Gắn sự kiện (chỉ một lần) ── */
  function wire() {
    if (wired) return true;
    scrim = q('#mobileScrim');
    tabbar = q('#mobileTabbar');
    settingsSheet = q('#mobileSettingsSheet');
    // Ngăn kéo là <aside class="sidebar" id="sidebar"> trong index.html. Vẫn chấp nhận
    // trường hợp chỉ có class để bản HTML cũ (đang nằm trong cache của người dùng)
    // không làm mất vuốt-để-đóng; nếu không tìm thấy gì thì cảnh báo rõ ràng.
    sidebar = q('#sidebar') || q('.sidebar');
    channelFilter = q('#mobileChannelFilter');
    channelList = q('#channelList');
    if (!scrim || !tabbar || !settingsSheet) return false;
    if (!sidebar) console.warn('CatChat: không tìm thấy ngăn kéo #sidebar — bỏ qua vuốt để đóng.');
    wired = true;

    tabbar.addEventListener('click', onTabClick);
    settingsSheet.addEventListener('click', onSettingsClick);
    scrim.addEventListener('click', () => closeSheet());
    q('#mobileDrawerClose')?.addEventListener('click', () => closeSheet());

    if (channelFilter) {
      channelFilter.addEventListener('input', applyChannelFilter);
      channelFilter.addEventListener('search', applyChannelFilter);
    }
    if (channelList) {
      // renderChannelList() thay toàn bộ con mỗi khi có kênh mới ⇒ áp lại bộ lọc.
      new MutationObserver(applyChannelFilter).observe(channelList, { childList: true });
    }
    attachDrawerSwipe();
    // Pha capture: khi đang mở ngăn kéo/bảng, Esc chỉ đóng đúng lớp đó và không
    // chạy tiếp chuỗi Escape của events.js (sẽ đóng nhầm menu ⋯, bảng thành viên…).
    document.addEventListener('keydown', (event) => {
      if (!isMobile() || !currentSheet()) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        closeSheet();
      }
    }, true);
    window.addEventListener('popstate', () => {
      if (!currentSheet()) {
        historyPushed = false;
        return;
      }
      closeSheet({ silent: true });
    });

    // Đổi kênh / mở mục khác trong ngăn kéo thì đóng ngăn kéo cho gọn.
    sidebar?.addEventListener('click', (event) => {
      if (!isMobile()) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('.channel-link, .nav-link, .announcements-link, .profile-logout, #channelAddButton')) {
        closeSheet({ silent: true, keepFocus: true });
      }
    });

    /* Lưới an toàn thứ hai: nghe ở pha capture trên document.
       Dù #sidebar không được tìm thấy (HTML cũ trong cache), hay một handler khác
       ném lỗi trước, thì bấm vào kênh / mục điều hướng vẫn luôn đóng ngăn kéo —
       nếu không người dùng sẽ thấy “một lớp mờ, không nhìn thấy gì” và không thoát ra được. */
    document.addEventListener('click', (event) => {
      if (!isMobile() || currentSheet() !== 'channels') return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('.channel-link, .nav-link, .announcements-link, .profile-logout, #channelAddButton, #mobileCreateChannelButton')) {
        closeSheet({ silent: true, keepFocus: true });
      }
    }, true);

    // Tự chữa: mọi thay đổi của data-mobile-sheet đều đồng bộ lại lớp mờ + bảng cài đặt.
    new MutationObserver(syncSheetChrome).observe(root, { attributes: true, attributeFilter: ['data-mobile-sheet'] });

    const appView = q('#appView');
    if (appView) {
      new MutationObserver(() => {
        syncChrome();
        syncViewTab();
      }).observe(appView, { attributes: true, attributeFilter: ['hidden', 'data-view'] });
    }
    const connectionPill = q('#connectionPill');
    if (connectionPill) {
      new MutationObserver(mirrorConnection).observe(connectionPill, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true,
        characterData: true,
        childList: true
      });
    }
    const adminButton = q('#openAdminButton');
    if (adminButton) {
      new MutationObserver(refreshSettings).observe(adminButton, { attributes: true, attributeFilter: ['hidden'] });
    }
    const savedCount = q('#savedMessagesCount');
    if (savedCount) {
      new MutationObserver(refreshSettings).observe(savedCount, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true,
        characterData: true,
        childList: true
      });
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        window.CatChatUIMode?.apply(window);
        syncChrome();
        syncViewTab();
      }, 160);
    });
    return true;
  }

  function boot() {
    if (!wire()) return;
    syncChrome();
    syncSheetChrome();
    syncViewTab();
    refreshSettings();
    mirrorConnection();
  }

  window.CatChatMobileUI = {
    openSheet,
    closeSheet,
    toggleSheet,
    currentSheet,
    filterChannels: applyChannelFilter,
    refresh: () => {
      syncChrome();
      syncSheetChrome();
      syncViewTab();
      refreshSettings();
      mirrorConnection();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
