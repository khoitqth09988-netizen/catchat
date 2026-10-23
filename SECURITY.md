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
| CSP + referrer policy | `index.html` `<meta>` | Chặn script lạ, chặn nhúng iframe, không gửi referrer đầy đủ |
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
- **Realtime Database → Rules**: dùng bộ Rules đã giao (chặn ghi khi thiếu quyền, chặn người bị mute/ban,
  chỉ admin ghi `/pins`, `/locks`, `/adminLog`).
- **Realtime Database → Backups**: bật để phục hồi nếu bị xoá dữ liệu.
- **Usage and billing → Budget alerts**: đặt cảnh báo để phát hiện lưu lượng bất thường (dấu hiệu bị đốt quota).
- **Firebase Hosting + Cloud Armor** (nếu có domain riêng): bật rate limiting / bot management ở tầng CDN.
- **Storage Rules**: giới hạn dung lượng và loại file ảnh, chỉ chủ tài khoản ghi vào thư mục của mình.

Firebase đã có hạ tầng chống DDoS ở tầng Google, nhưng **quota vẫn có thể bị đốt** bởi request hợp lệ về
hình thức — App Check + Rules + budget alert là bộ ba cần thiết.

## 4. Giới hạn cần biết của lớp phía máy khách

- Người dùng xoá `localStorage` là mất trạng thái phạt / khoá đăng nhập.
- Kẻ tấn công có thể gọi thẳng REST API của Firebase, không qua UI → chỉ Rules + App Check chặn được.
- Proof-of-work chỉ có tác dụng làm chậm script đơn giản, không chống được bot có GPU.
- Giới hạn được chọn để không ảnh hưởng người dùng bình thường; nếu cộng đồng đông hơn, tăng
  `MESSAGE_BUCKET` trong `anti-flood.js`.

## 5. Báo cáo lỗi bảo mật

Nếu phát hiện lỗ hổng, đừng tạo issue công khai. Gửi email cho quản trị viên kèm mô tả và bước tái hiện.
