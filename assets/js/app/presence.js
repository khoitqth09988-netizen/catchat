/* CatChat · Một nguồn duy nhất cho trạng thái “đang trực tuyến”.
   Tách từ index.html — nạp bằng <script defer> ngay sau state.js.

   Vì sao cần file này: trước đây mọi nơi tự kiểm tra `Boolean(presence[uid])`,
   nên chỉ cần node /presence/<uid> còn tồn tại là coi như online. Ba hệ quả thực tế:

     1. Đóng tab / mất mạng đột ngột không kịp chạy onDisconnect → node nằm lại,
        người đó “trực tuyến” mãi cho tới khi Firebase dọn (có khi vài giờ).
     2. Tài khoản đã bị xoá vẫn còn node → số “đang trực tuyến” lớn hơn số thành viên.
     3. Lần đầu mở app, node presence của chính mình chưa kịp ghi → hồ sơ của bạn
        hiện “Ngoại tuyến” dù đang chat bình thường.

   Cách làm gọn lại:
     • /presence/<uid> = { state: 'online', lastChanged: <giờ server> }
     • “Đang trực tuyến” = node còn mới (≤ PRESENCE_TTL) hoặc là chính mình khi
       kết nối Firebase còn sống.
     • Nhịp tim 60 giây làm mới lastChanged, nên tab bị trình duyệt bóp timer
       (tab nền) vẫn không bị coi là offline.
     • Chỉ đếm những uid thật sự có trong /members → số liệu khớp danh sách.
   Không thêm node mới ⇒ Firebase Rules không cần thay đổi. */
'use strict';

const PRESENCE_TTL_MS = 180000;   // 3 phút không có nhịp tim thì coi là ngoại tuyến
const PRESENCE_HEARTBEAT_MS = 60000;
const PRESENCE_TICK_MS = 30000;   // quét lại danh sách online mỗi 30 giây
const LAST_SEEN_WRITE_MS = 240000; // 4 phút ghi /members/<uid>/lastSeen một lần

let presenceHeartbeatTimer = 0;
let presenceHeartbeatUid = null;
let presenceServerOffset = 0;
let presenceOffsetRef = null;
let presenceHooksBound = false;
let lastSeenWrittenAt = 0;
let lastSeenWrittenUid = '';
let lastPresenceTouchAt = 0;

function presenceClockNow() {
  return Date.now() + (Number(presenceServerOffset) || 0);
}

function presenceTimestampOf(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  const raw = entry.lastChanged ?? entry.at ?? entry.since ?? 0;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Uid của chính mình, chỉ tính khi phiên kết nối Firebase còn sống. */
function presenceSelfUid() {
  if (typeof currentUser === 'undefined' || !currentUser) return '';
  if (typeof connectionIsOnline !== 'undefined' && connectionIsOnline) return currentUser.uid;
  return '';
}

/**
 * Một người có đang trực tuyến không?
 * - chính mình: dựa vào .info/connected để lần mở app đầu tiên không hiện sai.
 * - người khác: node presence phải còn mới; node cũ quá TTL bị coi là ngoại tuyến.
 */
function isUserOnline(uid) {
  if (!uid) return false;
  // Chính mình: chỉ cần biết đường truyền tới Firebase còn sống. Node presence của
  // mình có thể chưa kịp ghi (lần đầu mở app) hoặc đã cũ (vừa mất mạng).
  if (typeof currentUser !== 'undefined' && currentUser && uid === currentUser.uid) {
    return typeof connectionIsOnline !== 'undefined' && connectionIsOnline === true;
  }
  if (typeof presence === 'undefined' || !presence) return false;
  const entry = presence[uid];
  if (!entry) return false;
  if (entry === true) return true; // dữ liệu kiểu cũ (chỉ có true/false)
  if (typeof entry !== 'object') return false;
  if (entry.state && entry.state !== 'online') return false;
  const lastChanged = presenceTimestampOf(entry);
  if (!lastChanged) return true;   // không có mốc thời gian: tôn trọng dữ liệu đang có
  return presenceClockNow() - lastChanged <= PRESENCE_TTL_MS;
}

/** Danh sách uid đang trực tuyến, đã lọc theo /members (bỏ tài khoản đã xoá). */
function onlineMemberUids() {
  const list = [];
  const source = typeof members === 'object' && members ? members : {};
  Object.keys(source).forEach((uid) => {
    if (isUserOnline(uid)) list.push(uid);
  });
  const selfUid = presenceSelfUid();
  if (selfUid && !list.includes(selfUid) && !Object.prototype.hasOwnProperty.call(source, selfUid)) list.push(selfUid);
  return list;
}

function onlineMemberCount() {
  return onlineMemberUids().length;
}

/* ── Ghi presence ─────────────────────────────────────────────── */

function presenceRefFor(uid) {
  if (typeof presenceRef === 'undefined' || !presenceRef || !uid) return null;
  return presenceRef.child(uid);
}

function writePresence(uid) {
  const ref = presenceRefFor(uid);
  if (!ref) return;
  ref.set({ state: 'online', lastChanged: currentTimestamp() })
    .catch((error) => console.warn('Không cập nhật được trạng thái trực tuyến:', error));
}

/** Làm mới lastChanged (khi quay lại tab, mạng nối lại, hoặc theo nhịp tim).
    Giới hạn 10 giây một lần để đổi tab liên tục không tạo ra hàng loạt lệnh ghi. */
function touchPresence() {
  const uid = presenceHeartbeatUid || presenceSelfUid();
  if (!uid) return;
  if (typeof connectionIsOnline !== 'undefined' && !connectionIsOnline) return;
  const now = Date.now();
  if (now - lastPresenceTouchAt < 10000) return;
  lastPresenceTouchAt = now;
  writePresence(uid);
}

/**
 * Ghi mốc “hoạt động gần nhất” vào /members/<uid>/lastSeen.
 * Có giới hạn tần suất để không tốn băng thông; `force` dùng khi sắp đóng tab.
 */
function recordLastSeen(uid, force = false) {
  if (!uid) return;
  if (!force && typeof connectionIsOnline !== 'undefined' && !connectionIsOnline) return;
  const now = Date.now();
  if (!force && uid === lastSeenWrittenUid && now - lastSeenWrittenAt < LAST_SEEN_WRITE_MS) return;
  if (typeof membersRef === 'undefined' || !membersRef) return;
  lastSeenWrittenUid = uid;
  lastSeenWrittenAt = now;
  membersRef.child(uid).update({ lastSeen: currentTimestamp() })
    .catch((error) => console.warn('Presence update:', error));
}

function startPresenceHeartbeat(uid) {
  stopPresenceHeartbeat();
  presenceHeartbeatUid = uid || null;
  bindPresenceHooks();
  watchPresenceClock();
  if (!presenceHeartbeatUid) return;
  presenceHeartbeatTimer = window.setInterval(() => {
    if (!presenceHeartbeatUid) return;
    touchPresence();
    recordLastSeen(presenceHeartbeatUid);
  }, PRESENCE_HEARTBEAT_MS);
  startPresenceTicker();
}

function stopPresenceHeartbeat() {
  window.clearInterval(presenceHeartbeatTimer);
  presenceHeartbeatTimer = 0;
  presenceHeartbeatUid = null;
  stopPresenceTicker();
}

/* ── Nhịp quét TTL ────────────────────────────────────────────────
   Node presence của người khác có thể “chết” mà không ai ghi gì (đóng tab,
   mất mạng). Trước đây danh sách chỉ vẽ lại khi có sự kiện từ Firebase nên
   một người vẫn hiện “trực tuyến” rất lâu. Cứ 30 giây so lại danh sách uid
   đang online, khác thì vẽ lại. */
let presenceTicker = 0;
let presenceTickerKey = '';

function presenceOnlineKey() {
  return onlineMemberUids().slice().sort().join(',');
}

function startPresenceTicker() {
  if (presenceTicker) return;
  presenceTickerKey = presenceOnlineKey();
  presenceTicker = window.setInterval(() => {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    const key = presenceOnlineKey();
    if (key === presenceTickerKey) return;
    presenceTickerKey = key;
    if (typeof renderMembers === 'function') renderMembers();
  }, PRESENCE_TICK_MS);
}

function stopPresenceTicker() {
  window.clearInterval(presenceTicker);
  presenceTicker = 0;
  presenceTickerKey = '';
}

/* ── Mốc giờ server (.info/serverTimeOffset) ──────────────────────
   lastChanged do server ghi, còn máy người xem có thể lệch giờ vài phút.
   Đọc offset một lần để TTL không đánh giá sai. */
function watchPresenceClock() {
  if (presenceOffsetRef || typeof database === 'undefined' || !database) return;
  try {
    presenceOffsetRef = database.ref('.info/serverTimeOffset');
    presenceOffsetRef.on('value', (snapshot) => {
      const offset = Number(snapshot.val());
      presenceServerOffset = Number.isFinite(offset) ? offset : 0;
    }, () => { presenceServerOffset = 0; });
  } catch (_) {
    presenceOffsetRef = null;
  }
}

/* ── Sự kiện vòng đời ─────────────────────────────────────────── */

function bindPresenceHooks() {
  if (presenceHooksBound) return;
  presenceHooksBound = true;
  // Quay lại tab: đánh thức ngay, không chờ nhịp tim kế tiếp.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      touchPresence();
      recordLastSeen(presenceHeartbeatUid);
      return;
    }
    recordLastSeen(presenceHeartbeatUid);
  });
  // Trình duyệt sắp đóng / rời trang: ghi lastSeen một lần cuối (không chặn).
  window.addEventListener('pagehide', () => recordLastSeen(presenceHeartbeatUid, true));
  window.addEventListener('online', () => { touchPresence(); recordLastSeen(presenceHeartbeatUid, true); });
  // Khi tab nền bị bóp timer, mỗi lần người dùng quay lại là một nhịp bù.
  window.addEventListener('focus', () => touchPresence());
}

/* Ghi chú: không ghi “offline” khi mất mạng. Firebase sẽ xếp hàng lệnh ghi đó
   và áp dụng lúc nối lại, đè lên trạng thái online mới. onDisconnect().remove()
   lo trường hợp đóng tab bình thường, TTL lo trường hợp mất mạng đột ngột. */

window.CatChat = window.CatChat || {};
window.CatChat.presence = {
  ttlMs: PRESENCE_TTL_MS,
  heartbeatMs: PRESENCE_HEARTBEAT_MS,
  isOnline: isUserOnline,
  onlineUids: onlineMemberUids,
  onlineCount: onlineMemberCount,
  touch: touchPresence,
  recordLastSeen,
  onlineKey: presenceOnlineKey,
  start: startPresenceHeartbeat,
  stop: stopPresenceHeartbeat
};
