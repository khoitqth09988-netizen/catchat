/* CatChat · Feature: bảng phím tắt & điều hướng nhanh.
   - "?" mở bảng phím tắt.
   - Alt + ↑ / ↓ chuyển kênh trước/sau.
   - Alt + S mở tin nhắn đã lưu, Alt + T đổi giao diện, Alt + A mở bảng quản trị. */
'use strict';

(() => {
  const SHORTCUTS = [
    ['?', 'Mở bảng phím tắt này'],
    ['Alt + ↑ / ↓', 'Chuyển kênh trước / kế tiếp'],
    ['Alt + S', 'Mở tin nhắn đã lưu'],
    ['Alt + T', 'Đổi giao diện'],
    ['Alt + A', 'Mở bảng quản trị (admin)'],
    ['Ctrl / ⌘ + K', 'Tìm tin nhắn trong kênh'],
    ['/', 'Gợi ý lệnh gạch chéo'],
    ['Ctrl / ⌘ + Enter', 'Lưu khi đang sửa tin nhắn'],
    ['Esc', 'Đóng hộp thoại đang mở']
  ];

  let layer = null;
  let panel = null;

  function isTyping(target) {
    if (!(target instanceof Element)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function channelIds() {
    const ids = Object.keys(channels).filter((id) => id === 'general' || (channels[id] && typeof channels[id] === 'object'));
    if (!ids.includes('general')) ids.unshift('general');
    return ids.sort((a, b) => (a === 'general' ? -1 : b === 'general' ? 1 : channelNameFor(a).localeCompare(channelNameFor(b), 'vi')));
  }

  function stepChannel(direction) {
    if (!currentUser) return;
    const ids = channelIds();
    if (ids.length < 2) return;
    const index = Math.max(0, ids.indexOf(activeChannelId));
    const next = ids[(index + direction + ids.length) % ids.length];
    setWorkspaceView('chat');
    void switchChannel(next);
  }

  function buildPanel() {
    layer = document.createElement('div');
    layer.className = 'shortcut-layer';
    layer.id = 'shortcutLayer';
    layer.hidden = true;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'Bảng phím tắt');

    panel = document.createElement('div');
    panel.className = 'shortcut-panel';
    const header = document.createElement('div');
    header.className = 'shortcut-head';
    const title = document.createElement('strong');
    title.textContent = 'Phím tắt CatChat';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'shortcut-close';
    close.setAttribute('aria-label', 'Đóng bảng phím tắt');
    close.appendChild(icon('close'));
    close.addEventListener('click', () => setOpen(false));
    header.append(title, close);

    const list = document.createElement('dl');
    list.className = 'shortcut-list';
    SHORTCUTS.forEach(([keys, description]) => {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      const key = document.createElement('dt');
      const kbd = document.createElement('kbd');
      kbd.textContent = keys;
      key.appendChild(kbd);
      const value = document.createElement('dd');
      value.textContent = description;
      row.append(key, value);
      list.appendChild(row);
    });

    panel.append(header, list);
    layer.appendChild(panel);
    layer.addEventListener('click', (event) => { if (event.target === layer) setOpen(false); });
    document.body.appendChild(layer);
  }

  function setOpen(open) {
    if (!layer) return;
    layer.hidden = !open;
    if (open) {
      layer.classList.add('open');
      panel.querySelector('.shortcut-close').focus();
    } else {
      layer.classList.remove('open');
    }
  }

  CatChat.features.register({
    id: 'shortcuts',
    name: 'Bảng phím tắt',
    description: 'Xem và dùng phím tắt để di chuyển nhanh trong CatChat.',
    start() {
      buildPanel();
    },
    keydown(event) {
      if (!currentUser) return false;
      if (layer && !layer.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          return true;
        }
        return false;
      }
      if (isTyping(event.target)) return false;
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
        return true;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          stepChannel(-1);
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          stepChannel(1);
          return true;
        }
        const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
        if (key === 's') {
          event.preventDefault();
          openSavedPanel();
          return true;
        }
        if (key === 't') {
          event.preventDefault();
          openThemeDialog();
          return true;
        }
        if (key === 'a' && isAdmin) {
          event.preventDefault();
          openAdmin();
          return true;
        }
      }
      return false;
    }
  });
})();
