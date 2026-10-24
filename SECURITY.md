# Bảo mật CatChat

Tài liệu này ghi rõ **cái gì đang bảo vệ app**, **cái gì chỉ là giảm lạm dụng phía trình duyệt**, và
**cần làm gì ở Firebase/hạ tầng để chống DDoS thật**.

> Nguyên tắc: mọi thứ chạy trong trình duyệt đều có thể bị người dùng vượt qua (xoá localStorage,
> sửa JS, gọi thẳng REST API). Vì vậy chống DDoS/abuse thật **phải** nằm ở phía máy chủ.

## 1. Đã có trong code (phía máy khách)

| Lớp | File | Tác dụng |
|---|---|---|
| Giới hạn tần suất gửi tin | `assets/js/features/anti-flood.js` | 8 tin / 15 giây, cách nhau tối thiểu 600ms; thông báo 2 tin / 60 giây |
| Chống tin trùng | `anti-flood.js` | Cùng nội dung trong 60 giây → giãn nhịp 3 giây; lặp nhiều lần → phạt |
| Chống bùng nổ reaction | `anti-flood.js` (hook `guardWrite`) | 12 reaction / 10 giây cho mỗi tài khoản |
| Phạt tăng dần | `assets/js/app/security.js` (`CatChatGuard`) | 10s → 30s → 60s → 3 phút → 10 phút |
| Thử thách proof-of-work | `security.js` + `anti-flood.js` | Sau 3 lần vi phạm: giải SHA-256 (3 ký tự 0) hoặc câu hỏi số học dự phòng |
| Chặn dò mật khẩu | `assets/js/features/login-guard.js` | 5 lần đăng nhập / phút, khoá 1→30 phút, lưu qua localStorage |
| CSP + referrer policy | `index.html` `<meta>` + header trong `firebase.json` | Chặn script lạ, chặn nhúng iframe, không gửi referrer đầy đủ |
| App Check (tuỳ chọn) | `assets/js/app/appcheck.js` | Xác thực request đến từ chính app (chặn bot gọi API) |

Kiểm tra nhanh trong app: bảng lệnh nhanh `Alt + K` → **Xem tình trạng bảo vệ** / **Xác thực để gửi tin lại**.

## 2. Bật Firebase App Check (khuyến nghị, chống bot thật)

1. Firebase Console → **App Check** → Apps → chọn app web → **reCAPTCHA v3** → lấy site key.
2. Dán site key vào `assets/js/app/config.js`:

```js
appCheckSiteKey: "6Lc..."
```

3. Tải lại app, mở DevTools → Network, xác nhận request Firebase có header `X-Firebase-AppCheck`.
4. Kiểm tra vài ngày trong App Check → **Metrics** (không có lỗi `invalid`) rồi mới bật **Enforcement**
   cho **Realtime Database** và **Storage**.

Khi `appCheckSiteKey` để trống, `appcheck.js` không làm gì — app chạy y như trước.

## 3. Cấu hình Firebase nên bật

- **Authentication → Settings → User actions**: bật giới hạn tần suất gửi email xác thực / đặt lại mật khẩu.
- **Authentication → Sign-in method**: chỉ bật Email/Password nếu chỉ cần thế.
- **Gốc Rules phải đóng**: `database.rules.json` đặt `".read": false` / `".write": false` ở gốc rồi mở
  từng node. Đừng để `"true"` ở gốc: khi đó mọi tài khoản đã đăng nhập đều ghi được mọi node, người bị
  cấm tự xoá được `/bans`, `/deviceBans`, `/identityLocks` và tự thêm vào `/admins`.
- **`/admins` chỉ admin ghi**: tuyệt đối không đặt `.write: "true"` ở `admins/$uid` — đó là đường tự
  phong quản trị viên. Tài khoản admin đầu tiên thêm tay trong Firebase Console.
- **Realtime Database → Rules**: dùng bộ Rules đã giao (chặn ghi khi thiếu quyền, chặn người bị mute/ban,
  chỉ admin ghi `/pins`, `/locks`, `/adminLog`).
- **Realtime Database → Backups**: bật để phục hồi nếu bị xoá dữ liệu.
- **Usage and billing → Budget alerts**: đặt cảnh báo để phát hiện lưu lượng bất thường (dấu hiệu bị đốt quota).
- **Firebase Hosting + Cloud Armor** (nếu có domain riêng): bật rate limiting / bot management ở tầng CDN.
- **Storage Rules**: dán `storage.rules` của repo (Storage → Rules → Publish). Chỉ chủ tài khoản ghi
  được vào `chatImages/<uid>/…` (ảnh ≤ 5 MB) và `avatars/<uid>/…` (≤ 8 MB), chỉ `image/*`;
  mọi đường dẫn khác bị từ chối. Đây là **Storage Rules**, khác hoàn toàn Rules của Realtime Database.
- **`/adminLog` append-only**: Rules mới chỉ cho `push` mục mới (`!data.exists()`), admin cũng **không**
  xoá hay sửa được. Muốn “dọn” thì app ghi thêm một dấu `log-purge`; bảng điều khiển ẩn mục cũ nhưng
  dữ liệu gốc còn nguyên để kiểm toán.

Firebase đã có hạ tầng chống DDoS ở tầng Google, nhưng **quota vẫn có thể bị đốt** bởi request hợp lệ về
hình thức — App Check + Rules + budget alert là bộ ba cần thiết.

## 3b. Rules đã siết gì ở đợt 19

| Trước | Sau |
|---|---|
| `messages.name` chỉ kiểm `isString()` + độ dài | phải **bằng** `/members/<uid>/name` (admin được miễn) ⇒ hết giả danh `admin` |
| `messages.uid` do client tự khai | phải `=== auth.uid` (trừ admin) ⇒ không ghi tin dưới tên người khác |
| `timestamp` chỉ kiểm `isNumber()` | phải trong khoảng `now - 5 phút … now`, hoặc giữ nguyên giá trị cũ khi sửa ⇒ hết đẩy tin lên đầu |
| `/adminLog` cho admin `.write` cả node | `$entryId` chỉ `write` khi `!data.exists()` ⇒ append-only |
| Không có Storage Rules trong repo | `storage.rules` giới hạn thư mục theo uid, ≤ 5/8 MB, chỉ ảnh |

Đổi lại, app phải gửi đúng tên trong `/members/<uid>/name` khi tạo tin — việc này do
`authorNameFor()` trong `assets/js/app/database.js` lo (đồng bộ hồ sơ trước khi gửi).

> Vì Rules là thứ quyết định quyền ghi thật, hãy dán **toàn bộ** `database.rules.json` mới vào Console
> Realtime Database → Rules. Không tự deploy bằng CI (xem `.github/workflows/deploy.yml`).

## 4. Xoá tài khoản thành viên

- Admin xoá trong app: dữ liệu RTDB + cấm vĩnh viễn (`/bans/<uid>` với `deleted: true`).
  Việc cấm này được Rules dùng để chặn mọi thao tác ghi, và listener `/bans/<uid>` đăng xuất ngay lập tức.
- Bản ghi Firebase Authentication **chỉ** xoá được bằng Admin SDK: deploy `functions/` rồi bật
  `enableAccountDeletionFunction`, hoặc xoá tay ở Firebase Console → Authentication.
- Không xoá được chính mình và không xoá được tài khoản đang là admin (kiểm tra `/admins/<uid>`).
- `/deletedUsers` chỉ admin đọc/ghi, có `validate` để không ai ghi đè người khác.
- Sau khi xoá, người dùng có thể đăng ký lại bằng email cũ (UID mới). Muốn chặn hẳn cần kiểm tra email
  ở server hoặc chặn domain trong Firebase Authentication.

## 5. Giới hạn cần biết của lớp phía máy khách

- Người dùng xoá `localStorage` là mất trạng thái phạt / khoá đăng nhập.
- Kẻ tấn công có thể gọi thẳng REST API của Firebase, không qua UI → chỉ Rules + App Check chặn được.
- Proof-of-work chỉ có tác dụng làm chậm script đơn giản, không chống được bot có GPU.
- Giới hạn được chọn để không ảnh hưởng người dùng bình thường; nếu cộng đồng đông hơn, tăng
  `MESSAGE_BUCKET` trong `anti-flood.js`.

## 6. CSP nên đặt trong HTTP header

- Trình duyệt **bỏ qua `frame-ancestors` khi khai báo trong `<meta>`** (chỉ ghi một cảnh báo trong console).
  Vì vậy `firebase.json` gửi CSP thật trong header cho Firebase Hosting, kèm `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- `<meta http-equiv="Content-Security-Policy">` trong `index.html` vẫn giữ làm lớp dự phòng khi mở file
  trực tiếp; `script-src` gồm `www.gstatic.com` (Firebase SDK), `www.google.com` / `www.recaptcha.net`
  (App Check), `apis.google.com` và `*.firebaseapp.com` (helper của Firebase Auth).
- `worker-src 'self' blob:` cho phép Web Worker tạo từ Blob (nếu thêm sau này) mà không mở toàn bộ `script-src`.

## 7. Node `/typing` (chỉ báo đang gõ)

- Mỗi người chỉ ghi được vào `/typing/<channelId>/<uid>` với `$uid === auth.uid`, tài khoản đang bị cấm
  (`/bans/<uid>`) bị chặn hoàn toàn.
- `validate` chỉ cho phép `{ name: string ≤ 60, at: number }` nên không thể nhét dữ liệu lạ vào node này.
- Client tự xoá sau 4,2 giây ngừng gõ, tự hết hạn sau 7 giây, và `onDisconnect().remove()` dọn khi đóng tab.
- Nếu chưa dán node `/typing`, app không lỗi: tính năng tự tắt và chỉ ghi một cảnh báo trong console.

## 8. Báo cáo lỗi bảo mật

Nếu phát hiện lỗ hổng, đừng tạo issue công khai. Gửi email cho quản trị viên kèm mô tả và bước tái hiện.
