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
