/* CatChat · Feature: “ai đó đang nhập…”.
   Ghi trạng thái gõ vào /typing/<channelId>/<uid> = { name, at } rồi tự xoá sau vài giây.
   Cần thêm node /typing vào Firebase Realtime Database Rules (mình gửi kèm trong chat).
   Nếu Rules chưa có node này, tính năng tự tắt và phần còn lại của app vẫn chạy bình thường. */
'use strict';

(() => {
  const TTL = 7000;          // trạng thái gõ hết hạn sau 7 giây
  const REFRESH = 2400;      // giãn cách ghi tối thiểu giữa hai lần
  const IDLE_CLEAR = 4200;   // ngừng gõ 4,2 giây thì xoá trạng thái
  const TICK = 1600;         // nhịp dọn trạng thái hết hạn

  const typers = new Map();
  let stopListener = null;
  let listenedChannel = null;
  let tickTimer = null;
  let clearTimer = null;
  let lastSentAt = 0;
  let lastSentValue = '';
  let lastUid = null;
  let lastChannel = null;
  let disconnectKey = '';
  let writeBlocked = false;
  let started = false;

  function byId(id) {
    return document.getElementById(id) || null;
  }

  function typingNode() {
    if (typeof typingRef !== 'undefined' && typingRef) return typingRef;
    if (typeof database !== 'undefined' && database) return database.ref('typing');
    return null;
  }

  function activeUser() {
    return typeof currentUser !== 'undefined' ? currentUser : null;
  }

  function channelId() {
    return typeof activeChannelId !== 'undefined' ? activeChannelId : 'general';
  }

  function inAnnouncementMode() {
    return typeof announcementMode !== 'undefined' && announcementMode === true;
  }

  function warnOnce(error) {
    const code = error?.code || '';
    if (code === 'PERMISSION_DENIED' || /permission_denied/i.test(error?.message || '')) {
      writeBlocked = true;
      console.warn('Chỉ báo “đang nhập…” bị Rules chặn. Thêm node /typing vào Realtime Database Rules để bật lại.');
    }
  }

  /* ── Hiển thị ─────────────────────────────────────────────── */
  function prune() {
    const now = Date.now();
    Array.from(typers.entries()).forEach(([uid, entry]) => {
      if (!entry || now - Number(entry.at || 0) > TTL) typers.delete(uid);
    });
  }

  function typingLabel(names) {
    if (names.length === 1) return `${names[0]} đang nhập…`;
    if (names.length === 2) return `${names[0]} và ${names[1]} đang nhập…`;
    return `${names[0]} và ${names.length - 1} người khác đang nhập…`;
  }

  function render() {
    const box = byId('typingIndicator');
    if (!box) return;
    prune();
    const names = Array.from(typers.values())
      .map((entry) => String(entry?.name || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!names.length) {
      box.hidden = true;
      const text = byId('typingText');
      if (text) text.textContent = '';
      return;
    }
    const label = byId('typingText');
    if (label) label.textContent = typingLabel(names);
    box.hidden = false;
  }

  /* ── Ghi trạng thái của chính mình ────────────────────────── */
  function clearOwn() {
    window.clearTimeout(clearTimer);
    const node = typingNode();
    const uid = lastUid || activeUser()?.uid;
    const channel = lastChannel || channelId();
    lastSentAt = 0;
    lastSentValue = '';
    if (!node || !uid) return;
    node.child(channel).child(uid).remove().catch(() => {});
  }

  function scheduleIdleClear() {
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(clearOwn, IDLE_CLEAR);
  }

  function publish(force = false) {
    if (writeBlocked || started === false) return;
    const user = activeUser();
    const node = typingNode();
    const input = typeof els !== 'undefined' ? els.messageInput : byId('messageInput');
    if (!user || !node || !input || inAnnouncementMode()) return;
    const value = String(input.value || '').trim();
    if (!value) {
      if (force || lastSentValue) clearOwn();
      return;
    }
    const now = Date.now();
    if (!force && now - lastSentAt < REFRESH && value === lastSentValue) return;
    lastSentAt = now;
    lastSentValue = value;
    lastUid = user.uid;
    lastChannel = channelId();
    const ref = node.child(lastChannel).child(user.uid);
    // Chỉ đăng ký onDisconnect một lần cho mỗi cặp kênh/người dùng.
    const key = `${lastChannel}/${user.uid}`;
    if (disconnectKey !== key) {
      disconnectKey = key;
      ref.onDisconnect().remove().catch(() => {});
    }
    const name = (typeof displayNameFor === 'function' ? displayNameFor(user) : (user.displayName || user.email || 'Thành viên'))
      .slice(0, 32);
    ref.set({ name, at: now }).catch(warnOnce);
    scheduleIdleClear();
  }

  /* ── Nghe trạng thái của người khác ───────────────────────── */
  function handleSnapshot(snapshot) {
    const me = activeUser()?.uid;
    const now = Date.now();
    typers.clear();
    const raw = snapshot && typeof snapshot.val === 'function' ? (snapshot.val() || {}) : {};
    Object.entries(raw).forEach(([uid, entry]) => {
      if (!entry || uid === me) return;
      const at = Number(entry.at);
      if (!Number.isFinite(at) || now - at > TTL) return;
      typers.set(uid, { name: String(entry.name || '').slice(0, 32), at });
    });
    render();
  }

  function stopListening() {
    if (stopListener) {
      try { stopListener(); } catch (_) { /* listener đã bị dọn */ }
      stopListener = null;
    }
    listenedChannel = null;
    typers.clear();
    render();
  }

  function listen(targetChannel) {
    stopListening();
    const node = typingNode();
    if (!node || !activeUser()) return;
    const ref = node.child(targetChannel);
    const handler = (snapshot) => {
      if (channelId() !== targetChannel) return;
      handleSnapshot(snapshot);
    };
    const onError = (error) => {
      if (error?.code === 'PERMISSION_DENIED') {
        console.warn('Không đọc được /typing — thêm node /typing vào Rules để bật chỉ báo “đang nhập…”.');
      }
      typers.clear();
      render();
    };
    ref.on('value', handler, onError);
    stopListener = () => ref.off('value', handler);
    listenedChannel = targetChannel;
  }

  function tick() {
    if (!activeUser()) {
      stopListening();
      clearTimer = null;
      typers.clear();
      render();
      return;
    }
    if (typers.size) render();
  }

  /* ── Đăng ký tính năng ───────────────────────────────────── */
  function watchComposer() {
    const input = typeof els !== 'undefined' ? els.messageInput : byId('messageInput');
    if (!input) return;
    input.addEventListener('input', () => publish(false));
    input.addEventListener('blur', () => window.setTimeout(clearOwn, 700));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') clearOwn();
    });
    const form = byId('messageForm');
    if (form) form.addEventListener('submit', () => clearOwn());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearOwn();
    });
  }

  CatChat.features.register({
    id: 'typing-indicator',
    name: 'Đang nhập…',
    description: 'Hiện ai đang gõ trong kênh hiện tại (node /typing, cần Rules).',

    start() {
      started = true;
      lastUid = activeUser()?.uid || null;
      lastChannel = channelId();
      watchComposer();
      listen(channelId());
      tickTimer = window.setInterval(tick, TICK);
      window.addEventListener('beforeunload', () => clearOwn());
    },

    channelChanged(channelId) {
      clearOwn();
      lastChannel = channelId;
      lastUid = activeUser()?.uid || null;
      listen(channelId);
    },

    outgoingText(payload) {
      clearOwn();
      return payload;
    }
  });

  CatChat.typing = {
    active: () => Array.from(typers.keys()),
    clear: clearOwn,
    refresh: () => listen(channelId()),
    isBlocked: () => writeBlocked,
    stop() {
      window.clearInterval(tickTimer);
      tickTimer = null;
      clearOwn();
      stopListening();
    }
  };
})();
