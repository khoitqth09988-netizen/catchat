/* CatChat · Feature: bảng lệnh nhanh (Alt + K).
   Tìm nhanh kênh, thành viên và hành động trong app. Tính năng khác có thể thêm
   hành động của mình qua CatChat.actions.register(). */
'use strict';

(() => {
  let layer = null;
  let input = null;
  let list = null;
  let items = [];
  let selected = 0;

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function channelItems() {
    return Object.keys(channels)
      .filter((id) => id === 'general' || (channels[id] && typeof channels[id] === 'object'))
      .map((id) => ({
        id: `channel:${id}`,
        label: `#${channelNameFor(id)}`,
        hint: id === activeChannelId ? 'Kênh đang mở' : 'Chuyển kênh',
        icon: 'hash',
        group: 'Kênh',
        run() {
          setWorkspaceView('chat');
          if (id !== activeChannelId) void switchChannel(id, { skipConfirm: false });
        }
      }));
  }

  function memberItems() {
    return Object.entries(members || {}).map(([uid, member]) => ({
      id: `member:${uid}`,
      label: memberDisplayName(uid, member),
      hint: isUserOnline(uid) ? 'Đang trực tuyến · mở hồ sơ' : 'Mở hồ sơ thành viên',
      icon: 'user',
      group: 'Thành viên',
      run() {
        openMemberProfile(uid);
      }
    }));
  }

  function actionItems() {
    return (CatChat.actions?.list() || []).map((action) => ({
      id: `action:${action.id}`,
      label: action.label,
      hint: action.hint,
      icon: action.icon,
      group: action.group,
      run: action.run
    }));
  }

  function buildItems(query) {
    const all = [...channelItems(), ...actionItems(), ...memberItems()];
    const keyword = normalize(query).trim();
    if (!keyword) return all.slice(0, 30);
    const scored = [];
    all.forEach((item) => {
      const haystack = normalize(`${item.label} ${item.hint} ${item.group}`);
      const position = haystack.indexOf(keyword);
      if (position < 0) return;
      scored.push({ item, score: position + (normalize(item.label).startsWith(keyword) ? 0 : 40) });
    });
    return scored.sort((a, b) => a.score - b.score).map((entry) => entry.item).slice(0, 30);
  }

  function render(query) {
    items = buildItems(query);
    selected = 0;
    const fragment = document.createDocumentFragment();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'palette-empty';
      empty.textContent = 'Không tìm thấy kết quả nào.';
      fragment.appendChild(empty);
    }
    let currentGroup = '';
    items.forEach((item, index) => {
      if (item.group !== currentGroup) {
        currentGroup = item.group;
        const heading = document.createElement('div');
        heading.className = 'palette-group';
        heading.textContent = currentGroup;
        fragment.appendChild(heading);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `palette-item${index === selected ? ' active' : ''}`;
      button.dataset.paletteIndex = String(index);
      const mark = document.createElement('span');
      mark.className = 'palette-icon';
      mark.appendChild(icon(item.icon));
      const copy = document.createElement('span');
      copy.className = 'palette-copy';
      const strong = document.createElement('strong');
      strong.textContent = item.label;
      copy.appendChild(strong);
      if (item.hint) {
        const small = document.createElement('small');
        small.textContent = item.hint;
        copy.appendChild(small);
      }
      button.append(mark, copy);
      fragment.appendChild(button);
    });
    list.replaceChildren(fragment);
  }

  function moveSelection(step) {
    if (!items.length) return;
    selected = (selected + step + items.length) % items.length;
    list.querySelectorAll('.palette-item').forEach((node, index) => {
      node.classList.toggle('active', index === selected);
      if (index === selected) node.scrollIntoView({ block: 'nearest' });
    });
  }

  function runSelected() {
    const item = items[selected];
    if (!item) return;
    setOpen(false);
    try {
      item.run();
    } catch (error) {
      console.warn('Hành động trong bảng lệnh nhanh lỗi:', error);
      toast('Không chạy được hành động này.', 'error');
    }
  }

  function setOpen(open) {
    if (!layer) return;
    layer.hidden = !open;
    if (open) {
      layer.classList.add('open');
      input.value = '';
      render('');
      window.setTimeout(() => input.focus(), 30);
    } else {
      layer.classList.remove('open');
      els.messageInput?.focus({ preventScroll: true });
    }
  }

  function build() {
    layer = document.createElement('div');
    layer.className = 'palette-layer';
    layer.id = 'paletteLayer';
    layer.hidden = true;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'Bảng lệnh nhanh');

    const panel = document.createElement('div');
    panel.className = 'palette-panel';
    const search = document.createElement('div');
    search.className = 'palette-search';
    search.appendChild(icon('search'));
    input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Tìm kênh, thành viên hoặc hành động...';
    input.setAttribute('aria-label', 'Tìm nhanh trong CatChat');
    input.autocomplete = 'off';
    const badge = document.createElement('kbd');
    badge.textContent = 'Esc';
    search.append(input, badge);

    list = document.createElement('div');
    list.className = 'palette-list';
    list.setAttribute('role', 'listbox');

    panel.append(search, list);
    layer.appendChild(panel);
    layer.addEventListener('click', (event) => {
      if (event.target === layer) setOpen(false);
    });
    list.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-palette-index]') : null;
      if (!button) return;
      selected = Number(button.dataset.paletteIndex) || 0;
      runSelected();
    });
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        runSelected();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    });
    document.body.appendChild(layer);
  }

  CatChat.features.register({
    id: 'command-palette',
    name: 'Bảng lệnh nhanh',
    description: 'Alt + K để tìm và mở kênh, thành viên hoặc hành động trong một ô duy nhất.',
    start() {
      build();
      const shortcuts = [
        {
          id: 'theme-open',
          label: 'Đổi giao diện',
          hint: 'Mở bộ lông, màu nhấn, cỡ chữ',
          icon: 'palette',
          group: 'Điều hướng',
          run: () => openThemeDialog()
        },
        {
          id: 'saved-open',
          label: 'Tin nhắn đã lưu',
          hint: 'Xem lại những tin bạn đã ghim riêng',
          icon: 'bookmark',
          group: 'Điều hướng',
          run: () => openSavedPanel()
        },
        {
          id: 'search-open',
          label: 'Tìm tin nhắn trong kênh',
          hint: 'Lọc 100 tin nhắn gần nhất',
          icon: 'search',
          group: 'Điều hướng',
          run: () => setMessageSearchOpen(true)
        },
        {
          id: 'shortcuts-open',
          label: 'Bảng phím tắt',
          hint: 'Xem tất cả phím tắt của CatChat',
          icon: 'info',
          group: 'Điều hướng',
          run: () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }))
        },
        {
          id: 'admin-open',
          label: 'Bảng quản trị',
          hint: 'Tổng quan, thành viên, nhật ký',
          icon: 'shield',
          group: 'Quản trị',
          when: () => Boolean(isAdmin),
          run: () => openAdmin()
        }
      ];
      shortcuts.forEach((action) => {
        try {
          CatChat.actions.register(action);
        } catch (error) {
          console.warn('Không đăng ký được hành động', action.id, error);
        }
      });
    },
    keydown(event) {
      if (!currentUser) return false;
      const typing = event.target instanceof Element && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA');
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (event.altKey && !event.ctrlKey && !event.metaKey && key === 'k' && !typing) {
        event.preventDefault();
        setOpen(true);
        return true;
      }
      if (layer && !layer.hidden && event.key === 'Escape' && event.target !== input) {
        event.preventDefault();
        setOpen(false);
        return true;
      }
      return false;
    }
  });
})();
