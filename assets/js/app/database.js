/* CatChat · currentTimestamp, subscribe/cleanup realtime và hiển thị lỗi Firebase.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function currentTimestamp() {
  return database?.ServerValue?.TIMESTAMP || Date.now();
}

/** Tên hiển thị để ghi vào tin nhắn — phải trùng /members/<uid>/name.
    Rules đối chiếu đúng giá trị này, nên không ai giả danh admin bằng cách sửa `name`. */
async function authorNameFor(user = currentUser) {
  const uid = user?.uid;
  if (!uid) return displayNameFor(user).slice(0, 32);
  const cached = String(members?.[uid]?.name || '').trim();
  if (cached) return cached.slice(0, 32);
  if (membersRef) {
    try {
      await syncMemberProfile(user);
      const snapshot = await membersRef.child(uid).child('name').once('value');
      const stored = String(snapshot.val() || '').trim();
      if (stored) return stored.slice(0, 32);
    } catch (error) {
      console.warn('Chưa đọc được tên thành viên, dùng tên tài khoản:', error);
    }
  }
  return displayNameFor(user).slice(0, 32);
}

async function syncMemberProfile(user) {
  if (!database || !user) return;
  const ref = membersRef.child(user.uid);
  let existing = {};
  try { existing = (await ref.once('value')).val() || {}; } catch (_) { /* A write below may still be allowed by rules. */ }
  let name = displayNameFor(user).slice(0, 32);
  // Tên hiển thị là duy nhất: giữ chỗ slug của tên hiện tại.
  if (window.CatChat?.names?.ensure) {
    const claim = await CatChat.names.ensure(user.uid, name);
    if (claim && claim.ok === false && claim.taken) {
      // Tên đã có người khác dùng (dữ liệu cũ) — giữ tên cũ của chính mình nếu có,
      // nếu chưa có thì thêm hậu tố ngắn để không hiển thị trùng người khác.
      const previous = String(existing.name || '').trim();
      name = previous && CatChat.names.slugFor(previous) !== CatChat.names.slugFor(name)
        ? previous.slice(0, 32)
        : `${name} (${String(user.uid).slice(0, 4)})`.slice(0, 32);
      console.warn(`Tên “${displayNameFor(user)}” đã có người dùng, dùng tên “${name}” thay thế.`);
    }
  }
  await ref.update({
    uid: user.uid,
    name,
    photoURL: user.photoURL || existing.photoURL || '',
    createdAt: existing.createdAt || currentTimestamp(),
    lastSeen: currentTimestamp()
  });
  if (memberEmailsRef) {
    try { await memberEmailsRef.child(user.uid).update({ email: user.email || '' }); }
    catch (error) { console.warn('Không lưu được email riêng tư của thành viên:', error); }
  }
}

function subscribe(ref, eventName, callback, onError, cleanupBucket = cleanupFns) {
  const cancel = (error) => {
    if (onError) onError(error);
    else showDatabaseError(error, 'Không thể tải dữ liệu realtime.');
  };
  ref.on(eventName, callback, cancel);
  const stop = () => ref.off(eventName, callback);
  cleanupBucket.push(stop);
  return stop;
}

function stopChannelRealtime() {
  channelGeneration += 1;
  channelCleanupFns.forEach((stop) => { try { stop(); } catch (_) {} });
  channelCleanupFns = [];
  reactionStops.clear();
  messageReactions = {};
}

function cleanupRealtime() {
  cleanupFns.forEach((stop) => { try { stop(); } catch (_) {} });
  cleanupFns = [];
  stopChannelRealtime();
  stopAdminBanListener = null;
  stopAdminEmailListener = null;
  stopMuteListener = null;
  stopAdminLogListener = null;
  stopOwnMuteListener = null;
  stopPinListener = null;
  stopLockListener = null;
  hasAdminMarker = false;
  hasAdminClaim = false;
  hasAdminEmail = false;
  announcementMode = false;
  messages.clear();
  announcementMessages.clear();
  channels = {};
  activeChannelId = 'general';
  members = {};
  memberEmails = {};
  presence = {};
  bans = {};
  mutes = {};
  pins = {};
  locks = {};
  editingMessageId = null;
  editingDraft = '';
  adminLogEntries = [];
  clearReplyTarget();
  clearPendingImage();
}

function syncReactionListeners(generation, channelRun) {
  if (!messageReactionsRef) return;
  const activeIds = new Set(messages.keys());
  for (const [messageId, stop] of reactionStops) {
    if (!activeIds.has(messageId)) {
      stop();
      const cleanupIndex = channelCleanupFns.indexOf(stop);
      if (cleanupIndex !== -1) channelCleanupFns.splice(cleanupIndex, 1);
      reactionStops.delete(messageId);
      delete messageReactions[messageId];
    }
  }
  for (const messageId of activeIds) {
    if (reactionStops.has(messageId)) continue;
    const stop = subscribe(messageReactionsRef.child(messageId), 'value', (snapshot) => {
      if (generation !== authGeneration || channelRun !== channelGeneration) return;
      if (snapshot.exists()) messageReactions[messageId] = snapshot.val() || {};
      else delete messageReactions[messageId];
      refreshReactionStrip(messageId);
    }, (error) => showDatabaseError(error, 'Không thể tải reaction. Hãy kiểm tra quyền /messageReactions.'), channelCleanupFns);
    reactionStops.set(messageId, stop);
  }
}

function showDatabaseError(error, fallback) {
  const now = Date.now();
  if (now - lastDatabaseErrorAt < 5000) return;
  lastDatabaseErrorAt = now;
  const permissionDenied = error?.code === 'PERMISSION_DENIED' || /permission_denied/i.test(error?.message || '');
  toast(permissionDenied ? 'Firebase Security Rules chưa cấp quyền cho thao tác hoặc dữ liệu này.' : (fallback || 'Không thể kết nối cơ sở dữ liệu.'), 'error');
  if (error) console.warn('Firebase Realtime Database:', error);
}
