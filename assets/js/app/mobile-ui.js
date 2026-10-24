/* CatChat · Điều khiển giao diện app dành riêng cho điện thoại.
   ui-mode.js đã chọn html[data-ui="mobile"] | "desktop" và mobile-app.css lo phần
   bố cục. Tệp này chỉ nối các nút mới với hành vi cũ, không viết lại tính năng:
     · tab Kênh     → mở/đóng ngăn kéo (#sidebar gốc)
     · tab Trò chuyện → bấm #navChat (chuyển về khung chat)
     · tab Thành viên → bấm #navMembers (danh bạ toàn màn hình)
     · tab Cài đặt  → bảng trượt đáy, gọi lại đúng các nút có sẵn
                       (Giao diện, Quản trị, Đã lưu, Thông báo, Miu, Đăng xuất)
   Máy tính không chạy gì ở đây: mọi hàm đều thoát sớm khi data-ui != "mobile". */
'use strict';

(() => {
  const SHEETS = ['channels', 'settings'];
  const root = document.documentElement;
  const q = (selector) => document.querySelector(selector);

  let scrim = null;
  let tabbar = null;
  let settingsSheet = null;
  let lastFocus = null;
  let historyPushed = false;
  let wired = false;

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
    if (scrim) scrim.hidden = !sheet;
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

  function closeSheet({ silent = false, keepFocus = false } = {}) {
    if (!currentSheet()) return false;
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

  /* ── Gắn sự kiện (chỉ một lần) ── */
  function wire() {
    if (wired) return true;
    scrim = q('#mobileScrim');
    tabbar = q('#mobileTabbar');
    settingsSheet = q('#mobileSettingsSheet');
    if (!scrim || !tabbar || !settingsSheet) return false;
    wired = true;

    tabbar.addEventListener('click', onTabClick);
    settingsSheet.addEventListener('click', onSettingsClick);
    scrim.addEventListener('click', () => closeSheet());
    document.addEventListener('keydown', (event) => {
      if (!isMobile() || !currentSheet()) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeSheet();
      }
    });
    window.addEventListener('popstate', () => {
      if (!currentSheet()) {
        historyPushed = false;
        return;
      }
      closeSheet({ silent: true });
    });

    // Đổi kênh / mở mục khác trong ngăn kéo thì đóng ngăn kéo cho gọn.
    q('#sidebar')?.addEventListener('click', (event) => {
      if (!isMobile()) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('.channel-link, .nav-link, .announcements-link, .profile-logout, #channelAddButton')) {
        closeSheet({ silent: true, keepFocus: true });
      }
    });

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
