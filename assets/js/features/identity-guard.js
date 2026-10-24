/* CatChat · Feature: định danh thiết bị/IP + giới hạn số tài khoản trên một máy.
   Mục tiêu người dùng đặt ra:
     • admin cấm được tài khoản vĩnh viễn (đã có ở /bans, nay thêm nhãn + quyền chặn kèm thiết bị/IP);
     • cấm IP vĩnh viễn, cấm thiết bị vĩnh viễn;
     • một máy/IP chỉ được tạo tối đa 2 tài khoản; cái thứ 3 xuất hiện là toàn bộ
       tài khoản của định danh đó bị khoá và dọn khỏi hệ thống.

   GIỚI HẠN CẦN BIẾT (rất quan trọng, đừng hứa quá):
     – Trình duyệt KHÔNG tự biết IP công cộng của mình. Muốn có IP thật, phải deploy
       Cloud Function `getClientIdentity` (functions/index.js) rồi bật
       `enableIdentityFunction: true` trong config.js. Chưa deploy thì mọi thứ vẫn
       chạy nhưng chỉ chặn theo thiết bị (device fingerprint), không chặn được IP.
     – Device fingerprint là dấu vân tay trình duyệt + một UUID lưu trong localStorage.
       Xoá dữ liệu trình duyệt / dùng tab ẩn danh / đổi máy là ra mã mới. Đây là lớp
       giảm lạm dụng, KHÔNG phải bằng chứng tuyệt đối. Chặn thật phải làm ở Firebase
       Rules + App Check + Cloud Function.
     – Trình duyệt không xoá được tài khoản Firebase Auth của người khác. Việc dọn
       dữ liệu chạy được ngay; bản ghi Auth cần Cloud Function (như tính năng xoá
       tài khoản đã có).

   Dữ liệu (đều là hash 32 ký tự, không lưu IP thô):
     /memberIdentity/<uid>          { device, ipHash, at }        — chính chủ ghi
     /identityLedger/<deviceHash>/<uid>  { at, ipHash }           — đếm theo thiết bị
     /identityIpLedger/<ipHash>/<uid>    { at, device }           — đếm theo IP
     /deviceBans/<deviceHash>       { reason, by, at, permanent }
     /ipBans/<ipHash>               { reason, by, at, permanent }
     /identityLocks/<hash>          { kind, reason, at, uids, by } — khoá tự động
   Xem khối Rules gửi kèm trong báo cáo (và database.rules.json). */
'use strict';

(() => {
  const DEVICE_KEY = 'catchat-device-id-v1';
  const FP_KEY = 'catchat-device-fp-v1';
  const IP_KEY = 'catchat-ip-hash-v1';
  const IDENTITY_FUNCTION = 'getClientIdentity';
  const DEFAULT_MAX_ACCOUNTS = 2;

  let deviceId = '';
  let deviceHash = '';
  let ipHash = '';
  let readyPromise = null;
  let ready = false;
  let activeUid = '';
  let watchers = [];
  const identityCache = new Map();
  const pendingLookups = new Map();

  const readKey = (key) => {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  };
  const writeKey = (key, value) => {
    try { localStorage.setItem(key, value); } catch (_) { /* chế độ riêng tư */ }
  };

  /** config.js khai báo `const firebaseConfig` (không nằm trên window) → đọc an toàn. */
  function config() {
    try { return typeof firebaseConfig !== 'undefined' && firebaseConfig ? firebaseConfig : {}; }
    catch (_) { return {}; }
  }

  function maxAccounts() {
    const value = Number(config().maxAccountsPerIdentity);
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_MAX_ACCOUNTS;
  }

  function randomId() {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    }
  }

  /** SHA-256 → hex; có hàm dự phòng cho trình duyệt cũ / không có crypto.subtle. */
  async function hashHex(text) {
    try {
      if (window.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) { /* rơi xuống bản dự phòng */ }
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < text.length; i += 1) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + text.charCodeAt(i), 2246822519) >>> 0;
    }
    return (h1.toString(16) + h2.toString(16)).repeat(2).slice(0, 64);
  }

  function ensureDeviceId() {
    if (deviceId) return deviceId;
    deviceId = readKey(DEVICE_KEY) || '';
    if (!deviceId || deviceId.length < 8) {
      deviceId = randomId();
      writeKey(DEVICE_KEY, deviceId);
    }
    return deviceId;
  }

  function deviceSignature() {
    const nav = window.navigator || {};
    const screen = window.screen || {};
    const date = new Date();
    return [
      ensureDeviceId(),
      nav.userAgent || '',
      nav.platform || '',
      nav.language || '',
      (nav.languages || []).join(','),
      screen.width || 0,
      screen.height || 0,
      screen.colorDepth || 0,
      date.getTimezoneOffset(),
      nav.hardwareConcurrency || 0,
      nav.deviceMemory || 0,
      window.devicePixelRatio || 1
    ].join('|');
  }

  function resolveDb() {
    if (typeof database !== 'undefined' && database) return database;
    if (window.firebase?.apps?.length) return firebase.database();
    return null;
  }

  /** Lấy mã IP từ Cloud Function (nếu đã deploy + bật cờ trong config.js). */
  async function fetchIpHash() {
    const cached = readKey(IP_KEY);
    if (cached) ipHash = cached;
    if (!config().enableIdentityFunction) return;
    const app = window.firebase?.apps?.[0];
    if (!app || typeof window.firebase.functions !== 'function') return;
    try {
      const region = config().functionsRegion || 'us-central1';
      const callable = firebase.app().functions(region).httpsCallable(IDENTITY_FUNCTION);
      const result = await callable();
      const value = String(result?.data?.ipHash || '').slice(0, 64);
      if (value) {
        ipHash = value;
        writeKey(IP_KEY, value);
      }
    } catch (error) {
      console.warn('Chưa lấy được mã IP (cần deploy Cloud Function getClientIdentity):', error?.message || error);
    }
  }

  function ensureReady() {
    if (ready) return Promise.resolve(identity());
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      ensureDeviceId();
      deviceHash = readKey(FP_KEY) || (await hashHex(deviceSignature())).slice(0, 32);
      writeKey(FP_KEY, deviceHash);
      await fetchIpHash();
      ready = true;
      return identity();
    })();
    return readyPromise;
  }

  function identity() {
    return { deviceHash, ipHash, hasIp: Boolean(ipHash), deviceId: ensureDeviceId() };
  }

  function serverTimestamp() {
    return typeof currentTimestamp === 'function' ? currentTimestamp() : Date.now();
  }

  /* ── Đọc/ghi dữ liệu định danh ─────────────────────────────── */

  async function readOnce(path) {
    const db = resolveDb();
    if (!db) return null;
    try {
      return (await db.ref(path).once('value')).val();
    } catch (error) {
      console.warn(`Không đọc được /${path}:`, error?.message || error);
      return null;
    }
  }

  async function addToLedger(path, uid, payload) {
    const db = resolveDb();
    if (!db || !uid) return;
    try {
      await db.ref(path).child(uid).set(payload);
    } catch (error) {
      console.warn(`Không ghi được /${path}:`, error?.message || error);
    }
  }

  /** Ghi hồ sơ định danh của chính mình (được Rules cho phép). */
  async function recordIdentity(uid) {
    if (!uid) return null;
    await ensureReady();
    const db = resolveDb();
    if (!db) return null;
    const payload = { device: deviceHash, ipHash: ipHash || '', at: serverTimestamp() };
    try {
      await db.ref(`memberIdentity/${uid}`).update(payload);
    } catch (error) {
      console.warn('Không ghi được /memberIdentity:', error?.message || error);
    }
    await addToLedger(`identityLedger/${deviceHash}`, uid, { at: serverTimestamp(), ipHash: ipHash || '' });
    if (ipHash) await addToLedger(`identityIpLedger/${ipHash}`, uid, { at: serverTimestamp(), device: deviceHash });
    identityCache.set(uid, { device: deviceHash, ipHash: ipHash || '', at: Date.now() });
    return payload;
  }

  /** Đọc hồ sơ định danh của một thành viên (chỉ admin dùng tới, Rules quyết định). */
  async function lookup(uid, { force = false } = {}) {
    if (!uid) return null;
    if (!force && identityCache.has(uid)) return identityCache.get(uid);
    if (pendingLookups.has(uid)) return pendingLookups.get(uid);
    const task = (async () => {
      const value = await readOnce(`memberIdentity/${uid}`);
      // Ghi cả trường hợp “không có dữ liệu” vào cache: giao diện gọi hàm này trong
      // lúc vẽ hồ sơ, nếu không nhớ kết quả rỗng sẽ lặp vô hạn vòng đọc → vẽ lại.
      const result = {
        device: String(value?.device || ''),
        ipHash: String(value?.ipHash || ''),
        at: Number(value?.at) || 0
      };
      identityCache.set(uid, result);
      return result.device || result.ipHash ? result : null;
    })();
    pendingLookups.set(uid, task);
    try {
      return await task;
    } finally {
      pendingLookups.delete(uid);
    }
  }

  /* ── Cấm / mở cấm ─────────────────────────────────────────── */

  async function banDevice(hash, reason = '', extra = {}) {
    const value = String(hash || '').trim();
    if (!value) throw new Error('Thiếu mã thiết bị.');
    const db = resolveDb();
    if (!db) throw new Error('Chưa kết nối Firebase.');
    await db.ref(`deviceBans/${value}`).set({
      reason: String(reason || '').slice(0, 180),
      by: currentUser?.uid || '',
      byName: typeof displayNameFor === 'function' ? displayNameFor(currentUser || {}).slice(0, 32) : '',
      at: serverTimestamp(),
      permanent: true,
      ...extra
    });
    return value;
  }

  async function unbanDevice(hash) {
    const db = resolveDb();
    if (!db || !hash) return;
    await db.ref(`deviceBans/${hash}`).remove();
  }

  async function banIp(hash, reason = '', extra = {}) {
    const value = String(hash || '').trim();
    if (!value) throw new Error('Thiếu mã IP.');
    const db = resolveDb();
    if (!db) throw new Error('Chưa kết nối Firebase.');
    await db.ref(`ipBans/${value}`).set({
      reason: String(reason || '').slice(0, 180),
      by: currentUser?.uid || '',
      byName: typeof displayNameFor === 'function' ? displayNameFor(currentUser || {}).slice(0, 32) : '',
      at: serverTimestamp(),
      permanent: true,
      ...extra
    });
    return value;
  }

  async function unbanIp(hash) {
    const db = resolveDb();
    if (!db || !hash) return;
    await db.ref(`ipBans/${hash}`).remove();
  }

  /** Cấm vĩnh viễn một tài khoản kèm thiết bị + IP đang dùng (nếu biết). */
  async function banAccountEverywhere(uid, reason = '') {
    if (!uid) throw new Error('Thiếu UID.');
    const db = resolveDb();
    if (!db) throw new Error('Chưa kết nối Firebase.');
    const info = await lookup(uid, { force: true });
    await db.ref(`bans/${uid}`).set({
      reason: String(reason || '').slice(0, 180),
      bannedBy: currentUser?.uid || '',
      bannedAt: serverTimestamp(),
      permanent: true
    });
    if (info?.device) {
      try { await banDevice(info.device, reason || 'Cấm vĩnh viễn kèm tài khoản.', { sourceUid: uid }); } catch (_) {}
    }
    if (info?.ipHash) {
      try { await banIp(info.ipHash, reason || 'Cấm vĩnh viễn kèm tài khoản.', { sourceUid: uid }); } catch (_) {}
    }
    return { uid, device: info?.device || '', ipHash: info?.ipHash || '' };
  }

  /* ── Khoá danh tính khi vượt hạn mức ──────────────────────── */

  async function lockIdentity({ reason, uids, kind = 'device', hash = deviceHash }) {
    const db = resolveDb();
    if (!db || !hash) return null;
    const map = {};
    (uids || []).forEach((uid) => { if (uid) map[uid] = true; });
    const payload = {
      kind,
      reason: String(reason || '').slice(0, 180),
      at: serverTimestamp(),
      by: currentUser?.uid || 'system',
      uids: map
    };
    try {
      await db.ref(`identityLocks/${hash}`).set(payload);
    } catch (error) {
      console.warn('Không ghi được /identityLocks:', error?.message || error);
    }
    // Cố gắng cấm từng tài khoản (Rules thường chỉ cho admin ghi /bans —
    // nếu bị từ chối thì lớp khoá identityLocks ở trên vẫn chặn được đăng nhập).
    await Promise.allSettled((uids || []).map((uid) => db.ref(`bans/${uid}`).set({
      reason: payload.reason,
      bannedBy: currentUser?.uid || 'system',
      bannedAt: serverTimestamp(),
      permanent: true,
      identityLock: hash
    })));
    return payload;
  }

  async function unlockIdentity(hash) {
    const db = resolveDb();
    if (!db || !hash) return;
    await db.ref(`identityLocks/${hash}`).remove();
  }

  /**
   * Kiểm tra xem định danh hiện tại có đang nằm trong danh sách cấm/khoá không.
   * Trả về { blocked, reason, kind }.
   */
  async function checkBlocked() {
    await ensureReady();
    const db = resolveDb();
    if (!db) return { blocked: false };
    const targets = [];
    if (deviceHash) {
      targets.push([`deviceBans/${deviceHash}`, 'Thiết bị này đã bị chặn vĩnh viễn khỏi CatChat.', 'device']);
      targets.push([`identityLocks/${deviceHash}`, 'Thiết bị này đã bị khoá do tạo quá số tài khoản cho phép.', 'lock']);
    }
    if (ipHash) {
      targets.push([`ipBans/${ipHash}`, 'Địa chỉ IP này đã bị chặn vĩnh viễn khỏi CatChat.', 'ip']);
      targets.push([`identityLocks/${ipHash}`, 'Địa chỉ IP này đã bị khoá do tạo quá số tài khoản cho phép.', 'lock']);
    }
    for (const [path, fallback, kind] of targets) {
      const value = await readOnce(path);
      if (!value) continue;
      const reason = typeof value === 'object' && value.reason ? String(value.reason) : fallback;
      return { blocked: true, reason, kind, path };
    }
    return { blocked: false };
  }

  /**
   * Cổng vào app: kiểm tra cấm + ghi nhận định danh + kiểm tra hạn mức.
   * `blocked: true` nghĩa là KHÔNG cho vào không gian trò chuyện.
   */
  function isAdminNow() {
    // Lúc cổng đăng nhập chạy, `isAdmin` chưa được tính xong (listener /admins tới sau),
    // nên xét thêm email admin + custom claim để admin không bị dọn nhầm.
    try {
      if (typeof isAdmin !== 'undefined' && isAdmin === true) return true;
      if (typeof hasAdminEmail !== 'undefined' && hasAdminEmail === true) return true;
      if (typeof hasAdminClaim !== 'undefined' && hasAdminClaim === true) return true;
      if (typeof hasAdminMarker !== 'undefined' && hasAdminMarker === true) return true;
      if (typeof isAdminEmail === 'function' && typeof currentUser !== 'undefined' && currentUser) {
        return isAdminEmail(currentUser) === true;
      }
    } catch (_) { /* state chưa sẵn sàng */ }
    return false;
  }

  function accountPurge() {
    const api = window.CatChat?.accountDeletion;
    return api && typeof api.purge === 'function' ? api.purge : null;
  }

  async function enforce(uid) {
    activeUid = uid || '';
    const blocked = await checkBlocked();
    if (blocked.blocked) return blocked;
    if (!uid) return { blocked: false };

    await recordIdentity(uid);

    const db = resolveDb();
    if (!db) return { blocked: false };
    const devices = (await readOnce(`identityLedger/${deviceHash}`)) || {};
    const deviceUids = Object.keys(devices);
    let ipUids = [];
    if (ipHash) {
      const ips = (await readOnce(`identityIpLedger/${ipHash}`)) || {};
      ipUids = Object.keys(ips);
    }
    const limit = maxAccounts();
    const overDevice = deviceUids.length > limit;
    const overIp = ipHash ? ipUids.length > limit : false;
    if (!overDevice && !overIp) return { blocked: false, accounts: deviceUids.length, limit };

    const uids = Array.from(new Set([...deviceUids, ...ipUids, uid]));
    const reason = overIp && overDevice
      ? `Tự khoá: một thiết bị/IP đã tạo quá ${limit} tài khoản.`
      : overIp
        ? `Tự khoá: IP này đã tạo quá ${limit} tài khoản.`
        : `Tự khoá: thiết bị này đã tạo quá ${limit} tài khoản.`;

    if (overDevice) await lockIdentity({ reason, uids, kind: 'device', hash: deviceHash });
    if (overIp) await lockIdentity({ reason, uids, kind: 'ip', hash: ipHash });

    // Dọn dữ liệu: admin xoá được mọi tài khoản; người thường chỉ xoá được chính
    // mình (Rules), phần còn lại nằm trong /identityLocks để admin dọn một cú bấm.
    const purged = [];
    const purge = accountPurge();
    if (purge) {
      const targets = isAdminNow() ? uids : [uid];
      for (const target of targets) {
        try {
          await purge(target, {
            removeMessages: false,
            removeReactions: true,
            reason,
            log: true
          });
          purged.push(target);
        } catch (error) {
          console.warn('Không dọn được tài khoản vượt hạn mức:', target, error);
        }
      }
    }
    return { blocked: true, reason, kind: 'quota', accounts: deviceUids.length, limit, uids, purged };
  }

  /* ── Theo dõi trực tiếp: đang dùng mà bị cấm thì đăng xuất ngay ── */

  async function watch(uid) {
    unwatch();
    await ensureReady();
    const db = resolveDb();
    if (!db || !uid) return;
    const paths = [`bans/${uid}`];
    if (deviceHash) paths.push(`deviceBans/${deviceHash}`, `identityLocks/${deviceHash}`);
    if (ipHash) paths.push(`ipBans/${ipHash}`, `identityLocks/${ipHash}`);
    paths.forEach((path) => {
      const ref = db.ref(path);
      const handler = (snapshot) => {
        if (!snapshot.exists()) return;
        if (path === `bans/${uid}`) return; // /bans đã có listener riêng trong session.js
        const value = snapshot.val() || {};
        const reason = String(value.reason || 'Thiết bị/IP của bạn đã bị quản trị viên chặn.');
        if (typeof setAuthNotice === 'function') setAuthNotice(reason, 'error');
        if (typeof toast === 'function') toast(reason, 'error');
        if (typeof auth !== 'undefined' && auth) void auth.signOut();
      };
      ref.on('value', handler);
      watchers.push(() => ref.off('value', handler));
    });
  }

  function unwatch() {
    watchers.forEach((stop) => { try { stop(); } catch (_) { /* bỏ qua */ } });
    watchers = [];
  }

  /* ── Dữ liệu cho bảng quản trị ───────────────────────────── */

  async function listAll() {
    await ensureReady();
    const [deviceBans, ipBans, locks, ledger] = await Promise.all([
      readOnce('deviceBans'),
      readOnce('ipBans'),
      readOnce('identityLocks'),
      readOnce('identityLedger')
    ]);
    const counts = {};
    Object.values(ledger || {}).forEach((entries) => {
      Object.keys(entries || {}).forEach((uid) => { counts[uid] = (counts[uid] || 0) + 1; });
    });
    return {
      deviceBans: deviceBans || {},
      ipBans: ipBans || {},
      locks: locks || {},
      accountsByUid: counts,
      identity: identity(),
      maxAccounts: maxAccounts(),
      ipEnabled: Boolean(config().enableIdentityFunction)
    };
  }

  async function purgeIdentityLock(hash, options = {}) {
    const db = resolveDb();
    if (!db || !hash) return { purged: [] };
    const lock = (await readOnce(`identityLocks/${hash}`)) || {};
    const uids = Object.keys(lock.uids || {});
    const purged = [];
    const purge = accountPurge();
    if (purge) {
      for (const uid of uids) {
        if (uid === currentUser?.uid) continue;
        try {
          await purge(uid, {
            removeMessages: options.removeMessages === true,
            removeReactions: true,
            reason: lock.reason || 'Tài khoản bị xoá do vượt hạn mức định danh.'
          });
          purged.push(uid);
        } catch (error) {
          console.warn('Không xoá được tài khoản trong khoá định danh:', uid, error);
        }
      }
    }
    return { purged, uids };
  }

  window.CatChat = window.CatChat || {};
  Object.assign(window.CatChat, {
    identity: {
      deviceHash: () => deviceHash,
      ipHash: () => ipHash,
      identity,
      ensureReady,
      enforce,
      checkBlocked,
      watch,
      unwatch,
      lookup,
      cached: (uid) => identityCache.get(uid) || null,
      record: recordIdentity,
      banDevice,
      unbanDevice,
      banIp,
      unbanIp,
      banAccountEverywhere,
      lockIdentity,
      unlockIdentity,
      listAll,
      purgeIdentityLock,
      maxAccounts
    }
  });

  CatChat.features.register({
    id: 'identity-guard',
    name: 'Chặn theo thiết bị & IP',
    description: 'Cấm vĩnh viễn thiết bị/IP, giới hạn 2 tài khoản mỗi máy.',
    start() {
      // Bắt đầu tính sẵn dấu vân tay để lúc đăng nhập không phải chờ.
      void ensureReady();
    }
  });
})();
