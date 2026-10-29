/* CatChat · Feature: định danh thiết bị/IP + giới hạn số tài khoản trên một máy.
   Mục tiêu người dùng đặt ra:
     • admin cấm được tài khoản vĩnh viễn (đã có ở /bans, nay thêm nhãn + quyền chặn kèm thiết bị/IP);
     • cấm IP vĩnh viễn, cấm thiết bị vĩnh viễn;
     • một máy/IP chỉ được tạo tối đa 2 tài khoản; cái thứ 3 xuất hiện là toàn bộ
       tài khoản của định danh đó bị khoá và dọn khỏi hệ thống.

   NGUYÊN TẮC AN TOÀN (đợt 29 — sau khi chính chủ dự án bị khoá nhầm):
     • Mọi lệnh đọc/ghi ở đây đều có HẠN CHÓT. Realtime Database khi mất mạng không
       báo lỗi mà treo, nên nếu không có hạn chót thì cổng vào treo theo ⇒ “mạng khoẻ
       mà không vào được”.
     • Quản trị viên KHÔNG BAO GIỜ bị cổng này chặn (kể cả khi máy họ tạo nhiều tài
       khoản để thử) — nếu không, chủ dự án tự khoá mình khỏi app của mình.
     • Vượt hạn mức chỉ KHOÁ định danh (không đăng nhập được), KHÔNG tự xoá dữ liệu và
       KHÔNG tự ghi /bans nữa. Trước đây cổng này tự cấm vĩnh viễn mọi tài khoản trên
       máy, kể cả tài khoản quản trị ⇒ muốn vào lại phải sửa tay trong Firebase.
     • Chỉ đếm những tài khoản còn tồn tại trong /members. Tài khoản đã xoá từng bị
       tính mãi mãi, nên sau vài lần tạo/xoá là bị khoá oan.

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
  // Hạn chót cho từng thao tác mạng (xem withTimeout trong ui-helpers.js).
  // Kiểm thử ghi đè được: window.__catchatIdentityTimeouts = { read, write, gate }.
  const TIMEOUTS = { read: 5000, write: 6000, gate: 13000 };
  const limitOf = (name) => {
    const override = Number(window.__catchatIdentityTimeouts?.[name]);
    return Number.isFinite(override) && override > 0 ? override : TIMEOUTS[name];
  };

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

  /** Bọc một promise bằng hạn chót; ui-helpers.js nạp trước tệp này. */
  function race(task, ms, fallback, label) {
    if (typeof withTimeout === 'function') return withTimeout(task, ms, fallback, label);
    return Promise.resolve(task).catch(() => fallback);
  }

  /* ── Đọc/ghi dữ liệu định danh ─────────────────────────────── */

  async function readOnce(path) {
    const db = resolveDb();
    if (!db) return null;
    const snapshot = await race(db.ref(path).once('value'), limitOf('read'), null, `đọc /${path}`);
    try {
      return snapshot ? snapshot.val() : null;
    } catch (_) {
      return null;
    }
  }

  async function addToLedger(path, uid, payload) {
    const db = resolveDb();
    if (!db || !uid) return;
    await race(db.ref(path).child(uid).set(payload), limitOf('write'), null, `ghi /${path}`);
  }

  /** Ghi hồ sơ định danh của chính mình (được Rules cho phép). */
  async function recordIdentity(uid) {
    if (!uid) return null;
    await ensureReady();
    const db = resolveDb();
    if (!db) return null;
    const payload = { device: deviceHash, ipHash: ipHash || '', at: serverTimestamp() };
    await race(db.ref(`memberIdentity/${uid}`).update(payload), limitOf('write'), null, 'ghi /memberIdentity');
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
      auto: true,
      reason: String(reason || '').slice(0, 180),
      at: serverTimestamp(),
      by: currentUser?.uid || 'system',
      uids: map
    };
    await race(db.ref(`identityLocks/${hash}`).set(payload), limitOf('write'), null, 'ghi /identityLocks');
    // KHÔNG ghi /bans ở đây nữa. Trước đây cổng này tự cấm vĩnh viễn mọi tài khoản
    // của định danh (kể cả tài khoản quản trị) nên chủ máy chỉ cần tạo tài khoản thứ 3
    // để thử là tự ban mình và không mở lại được app. Khoá định danh là đủ để chặn
    // đăng nhập; mở khoá một chỗ là mọi thứ trở lại bình thường.
    return payload;
  }

  /** Gỡ khoá định danh + dọn những /bans do cổng cũ tự ghi (chỉ admin mới xoá được). */
  async function unlockIdentity(hash) {
    const db = resolveDb();
    if (!db || !hash) return;
    const lock = await readOnce(`identityLocks/${hash}`);
    await race(db.ref(`identityLocks/${hash}`).remove(), limitOf('write'), null, 'xoá /identityLocks');
    const uids = Object.keys(lock?.uids || {});
    await Promise.allSettled(uids.map(async (uid) => {
      const ban = await readOnce(`bans/${uid}`);
      if (!ban || !isAutoBan(ban, hash)) return;
      await db.ref(`bans/${uid}`).remove();
    }));
  }

  /**
   * “Cấm tự động” là bản ghi do máy tạo (cổng định danh cũ hoặc quản trị cũ), không
   * phải quyết định của người thật. Nhận ra nhờ bannedBy === 'system' hoặc có mốc
   * identityLock. Những bản ghi này được phép tự dọn để không ai bị kẹt vĩnh viễn.
   */
  function isAutoBan(ban, hash = '') {
    if (!ban || typeof ban !== 'object') return false;
    if (hash && ban.identityLock && ban.identityLock !== hash) return false;
    return ban.bannedBy === 'system' || Boolean(ban.identityLock);
  }

  /**
   * Kiểm tra xem định danh hiện tại có đang nằm trong danh sách cấm/khoá không.
   * Trả về { blocked, reason, kind }.
   */
  async function checkBlocked({ skipAuto = false } = {}) {
    await ensureReady();
    const db = resolveDb();
    if (!db) return { blocked: false };
    const targets = [];
    if (deviceHash) {
      targets.push([`deviceBans/${deviceHash}`, 'Thiết bị này đã bị quản trị viên chặn khỏi CatChat.', 'device']);
      targets.push([`identityLocks/${deviceHash}`, 'Thiết bị này đã bị khoá vì tạo quá số tài khoản cho phép.', 'lock']);
    }
    if (ipHash) {
      targets.push([`ipBans/${ipHash}`, 'Địa chỉ IP này đã bị quản trị viên chặn khỏi CatChat.', 'ip']);
      targets.push([`identityLocks/${ipHash}`, 'Địa chỉ IP này đã bị khoá vì tạo quá số tài khoản cho phép.', 'lock']);
    }
    for (const [path, fallback, kind] of targets) {
      const value = await readOnce(path);
      if (!value) continue;
      // skipAuto: quản trị viên bỏ qua khoá do máy tự tạo (vẫn tôn trọng chặn tay).
      if (skipAuto && kind === 'lock' && value.auto !== false) continue;
      const reason = typeof value === 'object' && value.reason ? String(value.reason) : fallback;
      return {
        blocked: true,
        reason,
        kind,
        path,
        hash: path.split('/').pop(),
        auto: kind === 'lock' ? value.auto !== false : isAutoBan(value)
      };
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

  /**
   * Như isAdminNow() nhưng kiểm được cả khi các listener quyền chưa kịp chạy:
   * đọc trực tiếp /admins/<uid> (Rules cho chính chủ đọc) và so email quản trị.
   */
  async function isAdminUid(uid) {
    if (!uid) return false;
    if (isAdminNow()) return true;
    try {
      if (typeof isAdminEmail === 'function' && typeof currentUser !== 'undefined'
        && currentUser && currentUser.uid === uid && isAdminEmail(currentUser) === true) return true;
    } catch (_) { /* state chưa sẵn sàng */ }
    const marker = await readOnce(`admins/${uid}`);
    return marker === true;
  }

  function accountPurge() {
    const api = window.CatChat?.accountDeletion;
    return api && typeof api.purge === 'function' ? api.purge : null;
  }

  /**
   * Quản trị viên đăng nhập trên một máy từng bị cổng cũ khoá nhầm: gỡ luôn khoá tự
   * tạo của chính máy/IP đó, để những tài khoản khác trên cùng máy không bị kẹt theo.
   * Chỉ đụng tới khoá `auto` (do máy tạo); khoá do người thật đặt thì để nguyên.
   */
  async function clearAutoLocks() {
    const db = resolveDb();
    if (!db) return;
    const hashes = [deviceHash, ipHash].filter(Boolean);
    for (const hash of hashes) {
      const lock = await readOnce(`identityLocks/${hash}`);
      if (!lock || lock.auto === false) continue;
      await race(db.ref(`identityLocks/${hash}`).remove(), limitOf('write'), null, 'gỡ khoá tự động');
      console.warn('Đã gỡ khoá định danh tự động cho tài khoản quản trị:', hash.slice(0, 12));
    }
  }

  /**
   * Chỉ đếm những tài khoản CÒN TỒN TẠI trong /members.
   * /identityLedger là sổ ghi một chiều: người dùng tạo rồi xoá tài khoản vẫn nằm lại
   * đó mãi, nên nếu đếm thô thì chỉ vài lần tạo/xoá là bị khoá oan dù máy chỉ còn 1
   * tài khoản. Đọc /members không được (mạng lỗi) ⇒ trả null để cổng BỎ QUA hạn mức
   * thay vì khoá nhầm người dùng.
   */
  async function liveAccounts(candidateUids) {
    const db = resolveDb();
    if (!db) return null;
    const members = await readOnce('members');
    if (!members || typeof members !== 'object') return null;
    return candidateUids.filter((uid) => Object.prototype.hasOwnProperty.call(members, uid));
  }

  /**
   * Cổng vào app: cấm thiết bị/IP + ghi nhận định danh + kiểm tra hạn mức.
   * Toàn bộ có hạn chót: chậm mạng thì trả về “cho vào” chứ không treo splash.
   */
  async function enforce(uid) {
    const gate = (async () => {
      activeUid = uid || '';
      const admin = isAdminNow() || (await isAdminUid(uid));
      if (admin) await clearAutoLocks();
      // Quản trị viên bỏ qua khoá tự tạo (kể cả khi chính họ tạo nhiều tài khoản để thử).
      const blocked = await checkBlocked({ skipAuto: admin });
      if (blocked.blocked) return blocked;
      if (!uid) return { blocked: false };

      await recordIdentity(uid);

      const db = resolveDb();
      if (!db) return { blocked: false };
      const limit = maxAccounts();
      const devices = Object.keys((await readOnce(`identityLedger/${deviceHash}`)) || {});
      const ips = ipHash ? Object.keys((await readOnce(`identityIpLedger/${ipHash}`)) || {}) : [];
      // Không đọc được sổ định danh (mạng lỗi / Rules chưa dán) ⇒ bỏ qua hạn mức.
      if (!devices.length && !ips.length) return { blocked: false, accounts: 0, limit };
      const deviceUids = (await liveAccounts(devices));
      const ipUids = ipHash ? (await liveAccounts(ips)) : [];
      if (deviceUids === null || ipUids === null) {
        return { blocked: false, accounts: null, limit, skipped: 'members-unavailable' };
      }
      const overDevice = deviceUids.length > limit;
      const overIp = ipHash ? ipUids.length > limit : false;
      if (admin) {
        if (overDevice || overIp) console.warn('Quản trị viên vượt hạn mức định danh — bỏ qua cổng khoá.');
        return { blocked: false, accounts: deviceUids.length, limit, admin: true };
      }
      if (!overDevice && !overIp) return { blocked: false, accounts: deviceUids.length, limit };

      const uids = Array.from(new Set([...deviceUids, ...ipUids, uid]));
      const reason = overIp && overDevice
        ? `Máy/IP này đã dùng ${Math.max(deviceUids.length, ipUids.length)} tài khoản, quá mức ${limit} cho phép.`
        : overIp
          ? `IP này đã dùng ${ipUids.length} tài khoản, quá mức ${limit} cho phép.`
          : `Máy này đã dùng ${deviceUids.length} tài khoản, quá mức ${limit} cho phép.`;

      if (overDevice) await lockIdentity({ reason, uids, kind: 'device', hash: deviceHash });
      if (overIp) await lockIdentity({ reason, uids, kind: 'ip', hash: ipHash });

      // Không tự xoá dữ liệu của ai: chỉ khoá đăng nhập. Quản trị viên vào
      // “Cài đặt quản trị → Chặn thiết bị & IP” để mở khoá hoặc dọn tài khoản thừa.
      return {
        blocked: true,
        reason,
        kind: 'quota',
        help: `Quản trị viên có thể mở khoá trong Cài đặt quản trị → tab “Chặn thiết bị & IP” (mã ${deviceHash.slice(0, 8)}).`,
        accounts: Math.max(deviceUids.length, ipUids.length),
        limit,
        uids: uids.slice(0, 20),
        purged: []
      };
    })();
    return race(gate, limitOf('gate'), { blocked: false, timedOut: true }, 'kiểm tra định danh');
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
        // Khoá do máy tự tạo không được đá quản trị viên ra (họ cần vào để mở khoá).
        // Chặn tay (auto === false / có người thật đứng tên) thì vẫn áp dụng đầy đủ.
        if (isAdminNow() && (value.auto !== false || isAutoBan(value))) {
          console.warn('Bỏ qua khoá tự động cho tài khoản quản trị:', path);
          return;
        }
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
      isAdminUid,
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
      isAutoBan,
      liveAccounts,
      clearAutoLocks,
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
