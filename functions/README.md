# Cloud Functions — xoá tài khoản Firebase Auth

Trình duyệt **không thể** xoá tài khoản Auth của người khác; chỉ Firebase Admin SDK làm được.
Hàm `deleteUserAccount` trong thư mục này là bước cuối của tính năng "admin xoá tài khoản thành viên".

## Hàm làm gì

1. Kiểm tra người gọi là admin (custom claim `admin === true`, email trong `ADMIN_EMAILS`,
   hoặc UID có `/admins/<uid> = true`).
2. Từ chối nếu người gọi tự xoá chính mình hoặc mục tiêu đang là admin.
3. Gọi `admin.auth().deleteUser(uid)`.
4. Dọn nốt `/members`, `/memberEmails`, `/mutes`, `/admins` của UID đó và đánh dấu
   `deletedUsers/<uid>/authDeleted = true`.
5. Ghi `/adminLog` type `deleteAccount`.

## Deploy

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # sửa project id nếu khác chat-e58b5
cd functions && npm install
firebase deploy --only functions:deleteUserAccount
```

Sau khi deploy xong, mở `assets/js/app/config.js` và đổi:

```js
enableAccountDeletionFunction: true,
functionsRegion: "us-central1"        // đúng region đã deploy
```

Nếu chưa deploy, để `false`: app vẫn xoá dữ liệu + cấm vĩnh viễn UID (người đó không đăng nhập được
nữa), nhưng bản ghi trong Authentication phải xoá tay ở Firebase Console.

## Lưu ý

- Cloud Functions cần gói **Blaze** (trả theo mức dùng) — hàm này chạy rất ít nên chi phí không đáng kể.
- `ADMIN_EMAILS` trong `functions/index.js` phải khớp với danh sách admin trong Rules.
- Xoá xong, người dùng có thể đăng ký lại bằng email cũ (UID mới). Muốn chặn hẳn thì cần thêm
  bước kiểm tra email ở server hoặc chặn domain trong Firebase Authentication.


## Chặn theo thiết bị / IP (tuỳ chọn)

| Hàm | Loại | Việc nó làm |
|---|---|---|
| `getClientIdentity` | callable | Trả về `ipHash` (SHA-256 của IP + muối bí mật). Bật `enableIdentityFunction: true` trong `config.js` để app dùng. |
| `enforceIdentityLock` | callable | Admin dọn toàn bộ tài khoản trong `/identityLocks/<hash>` (xoá cả Auth). |
| `onIdentityLedgerWrite` | Realtime trigger | Khi một thiết bị vượt 2 tài khoản: tự tạo khoá, cấm và xoá toàn bộ tài khoản đó **ở server**. |

```bash
firebase functions:config:set identity.salt="chuoi-bi-mat-rieng-cua-ban"
firebase deploy --only functions:getClientIdentity,functions:enforceIdentityLock,functions:onIdentityLedgerWrite
```

- Nên đặt `IDENTITY_SALT` khác nhau giữa môi trường thử và thật; đổi muối sẽ làm toàn bộ mã IP cũ vô hiệu.
- Hàm tự khoá bỏ qua tài khoản quản trị (`/admins/<uid> = true` hoặc email trong `ADMIN_EMAILS`).
- Nếu chưa deploy, app vẫn chặn được theo dấu vân tay thiết bị ở phía trình duyệt (Rules quyết định quyền ghi).
