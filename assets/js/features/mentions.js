/* CatChat · Feature: @mention.
   - Gõ "@" trong khung soạn tin để chọn thành viên (mũi tên để chọn, Enter/Tab để chèn).
   - Tô sáng @tên trong nội dung tin nhắn.
   - Khi có người nhắc tên bạn: nháy tiêu đề tab, toast và âm báo (nếu đã bật). */
'use strict';

(() => {
  const SOUND_KEY = 'catchat-mention-sound-v1';
  const MAX_OPTIONS = 6;

  let popup = null;
  let options = [];
  let activeIndex = 0;
  let active = false;
  let triggerStart = -1;
  let soundEnabled = false;
  let audioContext = null;
  let titleTimer = null;

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function selfName() {
    if (!currentUser) return '';
    const self = members?.[currentUser.uid];
    return (self ? memberDisplayName(currentUser.uid, self) : displayNameFor(currentUser)).trim();
  }

  function knownMembers() {
    const list = [];
    const seen = new Set();
    const push = (uid, name) => {
      const clean = String(name || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) return;
      seen.add(clean.toLowerCase());
      list.push({ uid, name: clean });
    };
    if (currentUser) push(currentUser.uid, selfName());
    Object.entries(members || {}).forEach(([uid, member]) => push(uid, memberDisplayName(uid, member)));
    return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  function hidePopup() {
    if (!popup) return;
    popup.hidden = true;
    popup.replaceChildren();
    options = [];
    active = false;
    triggerStart = -1;
  }

  function insertMention(name) {
    if (!els.messageInput) return;
    const value = els.messageInput.value;
    const caret = els.messageInput.selectionStart ?? value.length;
    const start = triggerStart >= 0 ? triggerStart : caret;
    const before = value.slice(0, start);
    const after = value.slice(caret);
    els.messageInput.value = `${before}@${name} ${after}`;
    const nextCaret = before.length + name.length + 2;
    els.messageInput.setSelectionRange(nextCaret, nextCaret);
    els.messageInput.focus();
    updateMessageComposer();
    hidePopup();
  }

  function renderPopup(items) {
    if (!popup) return;
    if (!items.length) {
      hidePopup();
      return;
    }
    options = items;
    active = true;
    activeIndex = Math.min(activeIndex, items.length - 1);
    const fragment = document.createDocumentFragment();
    items.forEach((member, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mention-option${index === activeIndex ? ' active' : ''}`;
      button.dataset.mentionName = member.name;
      button.appendChild(makeAvatar(member.name, member.uid, 'avatar mention-avatar', members[member.uid]?.photoURL || ''));
      const copy = document.createElement('span');
      copy.className = 'mention-copy';
      const strong = document.createElement('strong');
      strong.textContent = member.name;
      const small = document.createElement('small');
      small.textContent = member.uid === currentUser?.uid ? 'Bạn' : `@${member.name}`;
      copy.append(strong, small);
      button.appendChild(copy);
      fragment.appendChild(button);
    });
    popup.replaceChildren(fragment);
    popup.hidden = false;
  }

  function refresh() {
    if (!els.messageInput) return;
    const value = els.messageInput.value;
    const caret = els.messageInput.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = /(^|[\s(])@([\p{L}\p{N}._-]*)$/u.exec(before);
    if (!match) {
      hidePopup();
      return;
    }
    triggerStart = caret - match[2].length - 1;
    const keyword = match[2].toLocaleLowerCase('vi');
    const items = knownMembers()
      .filter((member) => member.name.toLocaleLowerCase('vi').includes(keyword))
      .slice(0, MAX_OPTIONS);
    activeIndex = 0;
    renderPopup(items);
  }

  function highlightMentions(root) {
    if (!root || !root.textContent.includes('@')) return;
    const names = knownMembers().map((member) => member.name).filter((name) => name.length > 1);
    if (!names.length) return;
    const pattern = new RegExp(`@(${names.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`, 'gi');
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.includes('@')) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.message-code, .message-code-block, .message-link, .spoiler, .mention-chip')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      if (!pattern.test(text)) return;
      pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        const chip = document.createElement('span');
        chip.className = 'mention-chip';
        chip.textContent = match[0];
        if (match[1].toLocaleLowerCase('vi') === selfName().toLocaleLowerCase('vi')) chip.classList.add('mention-me');
        fragment.appendChild(chip);
        cursor = match.index + match[0].length;
      }
      if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
    });
  }

  function isMentioned(text) {
    const me = selfName();
    if (!me) return false;
    return new RegExp(`@${escapeRegExp(me)}(?![\\p{L}\\p{N}_-])`, 'iu').test(String(text || ''));
  }

  function playChime() {
    if (!soundEnabled) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      [880, 1180].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.06, now + index * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.16);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + index * 0.12);
        oscillator.stop(now + index * 0.12 + 0.18);
      });
    } catch (error) {
      soundEnabled = false;
    }
  }

  function flashTitle(name) {
    if (!document.hidden) return;
    const original = document.title;
    let flipped = false;
    window.clearInterval(titleTimer);
    titleTimer = window.setInterval(() => {
      flipped = !flipped;
      document.title = flipped ? `🐾 ${name} nhắc bạn!` : original;
    }, 1200);
    const stop = () => {
      window.clearInterval(titleTimer);
      document.title = original;
      window.removeEventListener('focus', stop);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    const onVisibility = () => { if (!document.hidden) stop(); };
    window.addEventListener('focus', stop);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch (error) { /* bỏ qua */ }
    toast(soundEnabled ? 'Đã bật âm báo khi được nhắc tên.' : 'Đã tắt âm báo khi được nhắc tên.', 'info');
    return soundEnabled;
  }

  CatChat.features.register({
    id: 'mentions',
    name: 'Nhắc tên (@mention)',
    description: 'Gợi ý thành viên khi gõ @, tô sáng mention và báo khi bạn được nhắc tên.',
    start() {
      try { soundEnabled = localStorage.getItem(SOUND_KEY) === '1'; } catch (error) { soundEnabled = false; }

      popup = document.createElement('div');
      popup.className = 'mention-popup';
      popup.id = 'mentionPopup';
      popup.hidden = true;
      popup.setAttribute('role', 'listbox');
      popup.setAttribute('aria-label', 'Gợi ý thành viên');
      const composer = els.messageInput.closest('form') || els.messageInput.parentElement;
      composer.parentElement.insertBefore(popup, composer);
      popup.addEventListener('mousedown', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-mention-name]') : null;
        if (!button) return;
        event.preventDefault();
        insertMention(button.dataset.mentionName);
      });

      els.messageInput.addEventListener('input', refresh);
      els.messageInput.addEventListener('click', refresh);
      els.messageInput.addEventListener('blur', () => window.setTimeout(hidePopup, 120));
      document.addEventListener('keydown', (event) => {
        if (!active || event.target !== els.messageInput) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopImmediatePropagation();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          activeIndex = (activeIndex + step + options.length) % options.length;
          renderPopup(options);
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (!options[activeIndex]) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          insertMention(options[activeIndex].name);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          hidePopup();
        }
      }, true);

      document.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-mention-sound]') : null;
        if (!button) return;
        const enabled = toggleSound();
        button.setAttribute('aria-pressed', String(enabled));
        button.classList.toggle('on', enabled);
        button.textContent = enabled ? 'Đang bật' : 'Đang tắt';
      });
      CatChat.actions.register({
        id: 'mention-sound',
        label: 'Bật/tắt âm báo khi được nhắc tên',
        hint: 'Phát tiếng chuông ngắn khi có người @bạn',
        icon: 'bell',
        group: 'Thông báo',
        when: () => Boolean(currentUser),
        run() {
          toggleSound();
        }
      });
    },
    messageBody(element) {
      highlightMentions(element);
    },
    incomingMessage({ data }) {
      if (!data || !currentUser || data.uid === currentUser.uid) return;
      if (!isMentioned(data.text)) return;
      flashTitle(data.name || 'Ai đó');
      playChime();
      toast(`${data.name || 'Ai đó'} vừa nhắc tên bạn trong #${channelNameFor(activeChannelId)}.`, 'info');
    },
    themeExtras(container) {
      const row = document.createElement('div');
      row.className = 'appearance-row';
      const label = document.createElement('span');
      label.className = 'appearance-label';
      label.textContent = 'Âm báo khi được nhắc tên';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `appearance-toggle${soundEnabled ? ' on' : ''}`;
      button.dataset.mentionSound = '1';
      button.setAttribute('aria-pressed', String(soundEnabled));
      button.textContent = soundEnabled ? 'Đang bật' : 'Đang tắt';
      row.append(label, button);
      container.appendChild(row);
    }
  });
})();
