/* CatChat · Cloud Function xoá tài khoản Firebase Auth (tuỳ chọn).
   Trình duyệt không thể xoá tài khoản Auth của người khác — chỉ Admin SDK làm được.
   Hàm này là bước cuối của tính năng "admin xoá tài khoản thành viên" trong app.

   Deploy:
     cd functions && npm install
     firebase deploy --only functions:deleteUserAccount
   Sau đó bật `enableAccountDeletionFunction: true` trong assets/js/app/config.js.

   Bảo vệ: chỉ tài khoản có custom claim `admin === true`, hoặc email nằm trong ADMIN_EMAILS,
   hoặc UID có /admins/<uid> = true mới gọi được. Không ai tự xoá được chính mình. */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const ADMIN_EMAILS = ['admin@com.vn'];
const REGION = 'us-central1';

exports.deleteUserAccount = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Cần đăng nhập.');
    }

    const caller = context.auth;
    const callerIsAdmin =
      caller.token?.admin === true ||
      ADMIN_EMAILS.includes(caller.token?.email || '') ||
      (await admin.database().ref(`admins/${caller.uid}`).once('value')).val() === true;

    if (!callerIsAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Chỉ quản trị viên được xoá tài khoản.');
    }

    const uid = String(data?.uid || '').trim();
    if (!uid) {
      throw new functions.https.HttpsError('invalid-argument', 'Thiếu uid.');
    }
    if (uid === caller.uid) {
      throw new functions.https.HttpsError('failed-precondition', 'Không thể tự xoá tài khoản đang đăng nhập.');
    }

    const targetIsAdmin = (await admin.database().ref(`admins/${uid}`).once('value')).val() === true;
    if (targetIsAdmin) {
      throw new functions.https.HttpsError('failed-precondition', 'Hạ quyền admin của thành viên này trước khi xoá.');
    }

    let deleted = false;
    try {
      await admin.auth().deleteUser(uid);
      deleted = true;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        deleted = true;
      } else {
        throw new functions.https.HttpsError('internal', `Không xoá được tài khoản Auth: ${error.message}`);
      }
    }

    // Dọn nốt dữ liệu phía server cho chắc, kể cả khi client đã dọn.
    const db = admin.database();
    await Promise.allSettled([
      db.ref(`members/${uid}`).remove(),
      db.ref(`memberEmails/${uid}`).remove(),
      db.ref(`mutes/${uid}`).remove(),
      db.ref(`admins/${uid}`).remove(),
      db.ref(`deletedUsers/${uid}/authDeleted`).set(true),
      db.ref(`deletedUsers/${uid}/authDeletedAt`).set(admin.database.ServerValue.TIMESTAMP)
    ]);

    await db.ref('adminLog').push({
      type: 'deleteAccount',
      detail: `Xoá tài khoản Auth của UID ${uid}`.slice(0, 220),
      targetUid: uid,
      adminUid: caller.uid,
      adminName: (caller.token?.name || caller.token?.email || 'Quản trị viên').slice(0, 32),
      timestamp: admin.database.ServerValue.TIMESTAMP
    });

    return { deleted: true, uid };
  });

/* ────────────────────────────────────────────────────────────────
   Định danh thiết bị / IP (tuỳ chọn, cần deploy để chặn được IP thật).

   getClientIdentity  — trả về mã IP đã băm (không lộ IP thô cho trình duyệt).
                        Bật `enableIdentityFunction: true` trong config.js sau khi deploy.
   enforceIdentityLock — admin dọn toàn bộ tài khoản trong một khoá định danh.
   onIdentityLedgerWrite — tự khoá + tự xoá khi một thiết bị tạo quá 2 tài khoản,
                        kể cả khi client không chạy (server là nơi quyết định).

   Biến môi trường: IDENTITY_SALT (chuỗi bí mật, đặt bằng
   firebase functions:config:set identity.salt="..." hoặc biến môi trường mới).
   ──────────────────────────────────────────────────────────────── */
const crypto = require('crypto');

const MAX_ACCOUNTS_PER_IDENTITY = 2;

function identitySalt() {
  const cfg = (() => {
    try { return functions.config().identity || {}; } catch (_) { return {}; }
  })();
  return process.env.IDENTITY_SALT || cfg.salt || 'catchat-identity-salt';
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(`${identitySalt()}|${ip || 'unknown'}`).digest('hex').slice(0, 32);
}

async function isAdminUid(uid) {
  if (!uid) return false;
  const snap = await admin.database().ref(`admins/${uid}`).once('value');
  return snap.val() === true;
}

exports.getClientIdentity = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Cần đăng nhập.');
    }
    const raw = context.rawRequest?.ip || context.rawRequest?.connection?.remoteAddress || '';
    const ip = String(raw).replace(/^::ffff:/, '');
    return { ipHash: hashIp(ip) };
  });

exports.enforceIdentityLock = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Cần đăng nhập.');
    }
    const callerIsAdmin =
      context.auth.token?.admin === true ||
      ADMIN_EMAILS.includes(context.auth.token?.email || '') ||
      (await isAdminUid(context.auth.uid));
    if (!callerIsAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Chỉ quản trị viên được dọn khoá định danh.');
    }
    const hash = String(data?.hash || '').trim();
    if (!hash) throw new functions.https.HttpsError('invalid-argument', 'Thiếu mã định danh.');

    const db = admin.database();
    const lock = (await db.ref(`identityLocks/${hash}`).once('value')).val() || {};
    const uids = Object.keys(lock.uids || {}).filter((uid) => uid !== context.auth.uid);
    const results = [];
    for (const uid of uids) {
      if (await isAdminUid(uid)) {
        results.push({ uid, deleted: false, reason: 'admin' });
        continue;
      }
      try { await admin.auth().deleteUser(uid); } catch (_) { /* có thể đã bị xoá */ }
      await Promise.allSettled([
        db.ref(`members/${uid}`).remove(),
        db.ref(`memberEmails/${uid}`).remove(),
        db.ref(`mutes/${uid}`).remove(),
        db.ref(`memberIdentity/${uid}`).remove(),
        db.ref(`deletedUsers/${uid}`).set({
          uid,
          reason: lock.reason || 'Vượt hạn mức định danh.',
          deletedBy: context.auth.uid,
          deletedAt: admin.database.ServerValue.TIMESTAMP,
          authDeleted: true
        })
      ]);
      results.push({ uid, deleted: true });
    }
    await db.ref('adminLog').push({
      type: 'deleteAccount',
      detail: `Dọn ${results.filter((r) => r.deleted).length} tài khoản trong khoá định danh ${hash.slice(0, 12)}`.slice(0, 220),
      adminUid: context.auth.uid,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    return { hash, results };
  });

/** Tự động khoá khi một thiết bị vượt hạn mức, chạy ở phía máy chủ. */
exports.onIdentityLedgerWrite = functions
  .region(REGION)
  .database.ref('/identityLedger/{deviceHash}/{uid}')
  .onWrite(async (change, context) => {
    if (!change.after.exists()) return null;
    const { deviceHash } = context.params;
    const db = admin.database();
    const entries = (await db.ref(`identityLedger/${deviceHash}`).once('value')).val() || {};
    const uids = Object.keys(entries).slice(0, 50);
    if (uids.length <= MAX_ACCOUNTS_PER_IDENTITY) return null;

    const reason = `Tự khoá: thiết bị ${deviceHash.slice(0, 8)}… đã tạo quá ${MAX_ACCOUNTS_PER_IDENTITY} tài khoản.`;
    const uidsMap = uids.reduce((acc, uid) => { acc[uid] = true; return acc; }, {});
    await db.ref(`identityLocks/${deviceHash}`).set({
      kind: 'device',
      reason,
      at: admin.database.ServerValue.TIMESTAMP,
      by: 'server',
      uids: uidsMap
    });

    for (const uid of uids) {
      if (await isAdminUid(uid)) continue;
      await db.ref(`bans/${uid}`).set({
        reason,
        bannedBy: 'server',
        bannedAt: admin.database.ServerValue.TIMESTAMP,
        permanent: true,
        identityLock: deviceHash
      });
      try { await admin.auth().deleteUser(uid); } catch (_) { /* đã xoá trước đó */ }
      await Promise.allSettled([
        db.ref(`members/${uid}`).remove(),
        db.ref(`memberEmails/${uid}`).remove(),
        db.ref(`mutes/${uid}`).remove(),
        db.ref(`memberIdentity/${uid}`).remove()
      ]);
    }

    await db.ref('adminLog').push({
      type: 'ban',
      detail: `${reason} Đã xoá ${uids.length} tài khoản.`.slice(0, 220),
      adminUid: 'server',
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    return null;
  });
