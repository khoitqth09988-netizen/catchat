# CatChat 🐾

Ứng dụng chat cộng đồng chạy hoàn toàn trên trình duyệt với Firebase (Auth + Realtime Database + Storage).
Trước đây toàn bộ app nằm trong một `index.html`; nay mã nguồn đã được tách thành nhiều file để dễ đọc,
dễ mở rộng và có thể thêm tính năng mới mà không phải sửa code lõi.

## Cấu trúc

```
index.html                     Khung HTML + sprite icon + thứ tự nạp CSS/JS
assets/css/                    Giao diện, tách theo khu vực
  base.css                     Reset, biến màu, màn hình đăng nhập, khung chat
  workspace.css                Bố cục kiểu Discord: sidebar, kênh, hàng tin nhắn
  themes.css                   5 theme: light, dark, lavender, ocean, halloween
  cat-skin.css                 Lớp da “tổ mèo”: bong bóng, sticker, Miu, con trỏ mèo
  halloween.css                Bảng màu gốc của theme Halloween
  views.css                    Tab thành viên, hồ sơ, emoji picker, kiểm duyệt
  chat-extras.css              Reaction và phòng thông báo
  admin.css                    Admin nâng cao: tổng quan, cấm chat, nhật ký
  moderation.css               Sửa/ghim tin nhắn, khoá kênh
  features.css                 Giao diện của các tính năng mở rộng
  halloween-night.css          Halloween ma mị (nạp cuối để ghi đè theme Halloween)
assets/js/app/                 Lõi ứng dụng, nạp theo thứ tự bằng <script defer>
  config.js                    Hằng số, cấu hình Firebase, helper $ / $$
  state.js                     Tham chiếu DOM, tham chiếu Firebase, state dùng chung
  ui-helpers.js                Icon, textElement, avatar, helper quyền/mute
  security.js                  CatChatGuard: rate limit, phạt tăng dần, proof-of-work
  appcheck.js                  Firebase App Check (tuỳ chọn) — chặn bot/script lạ
  theme.js                     Lưu và áp dụng giao diện
  auth.js                      Đăng nhập, đăng ký, đặt lại mật khẩu
  database.js                  subscribe/cleanup realtime, hiển thị lỗi Firebase
  channels.js                  Danh sách kênh, chuyển/tạo kênh, listener tin nhắn
  session.js                   setAdminState, phiên đăng nhập, presence, avatar
  message-format.js            Định dạng thời gian, nhãn ngày, nút trả lời
  messages.js                  Reaction, render tin nhắn, tìm kiếm, ghim hiển thị
  composer.js                  Khung soạn tin, gửi tin, gửi thông báo
  message-actions.js           Xoá tin nhắn, dọn kênh
  members.js                   Tab thành viên, danh bạ, hồ sơ, emoji picker
  extras.js                    Tin nhắn đã lưu, sticker, Miu, vết chân mèo, con trỏ
  admin.js                     Xác nhận, cấm thành viên, mở/đóng bảng admin, toast
  admin-tools.js               Kiểm duyệt tin nhắn trong admin
  moderation.js                Sửa/xoá/ghim tin, khoá kênh, mute, nhật ký, export
  events.js                    Toàn bộ event listener + khởi tạo Firebase
  features-core.js             Lõi hệ thống tính năng (registry + hook)
  boot.js                      Khởi động app (luôn nạp cuối)
assets/js/features/            Tính năng mở rộng, mỗi tính năng một file
  slash-commands.js            Lệnh gõ “/”: /me, /shrug, /flip, /8ball, /cat, /roll, /help
  rich-text.js                 Định dạng tin nhắn: **đậm**, *nghiêng*, ~~gạch~~, `mã`,
                               ```khối mã```, ||spoiler|| và liên kết tự động
  mentions.js                  Gợi ý @tên khi gõ, tô sáng mention, nháy tiêu đề + chuông
                               khi bạn được nhắc tên
  message-tools.js             Nút sao chép tin nhắn + “Tìm tin nhắn trong kênh” ở hồ sơ
  drafts.js                    Bản nháp riêng cho từng kênh (localStorage), Alt+D để xoá
  shortcuts.js                 Bảng phím tắt “?”, Alt+↑/↓ chuyển kênh, Alt+S/T/A
  command-palette.js           Bảng lệnh nhanh Alt+K: kênh, thành viên, hành động
  appearance-extras.js         Màu nhấn, cỡ chữ, mật độ tin nhắn trong hộp thoại giao diện
  anti-flood.js                Giới hạn tần suất gửi tin, chống trùng, chống spam reaction
  login-guard.js               Chặn dò mật khẩu: 5 lần/phút rồi khoá tăng dần
SECURITY.md                    Checklist bảo mật: App Check, Rules, quota, CSP
```

Không dùng bundler: mọi file là script cổ điển nạp bằng `<script defer>` để giữ đúng thứ tự,
nên vẫn mở trực tiếp `index.html` bằng `file://` được (chỉ cần Internet cho Firebase SDK).

**Tên file không đánh số.** Thứ tự nạp được quy định duy nhất bởi danh sách `<script>` / `<link>`
trong `index.html` — muốn đổi thứ tự thì sửa ở đó, không phụ thuộc tên file.

## Thêm một tính năng mới

1. Tạo `assets/js/features/ten-tinh-nang.js`:

```js
(() => {
  CatChat.features.register({
    id: 'ten-tinh-nang',
    name: 'Tên tính năng',
    start() { /* chạy một lần khi app khởi động: gắn DOM, listener riêng */ },
    outgoingText(payload) { /* đổi payload.text hoặc trả { cancel: true } để chặn gửi */ },
    messageBody(element, { id, data }) { /* định dạng/tô màu nội dung tin nhắn */ },
    incomingMessage({ id, data, channelId }) { /* tin nhắn mới vừa tới */ },
    channelChanged(channelId) { /* vừa chuyển kênh */ },
    messageTools(container, { id, data }) { /* thêm nút vào thanh công cụ tin nhắn */ },
    memberActions({ uid, name, addAction }) { /* thêm hành động trong hồ sơ thành viên */ },
    themeExtras(container) { /* thêm điều khiển vào hộp thoại giao diện */ },
    keydown(event) { /* trả về true nếu đã xử lý phím */ }
  });

  // Hành động dùng chung: tự hiện trong bảng lệnh nhanh Alt+K
  CatChat.actions.register({
    id: 'ten-hanh-dong',
    label: 'Nhãn hiển thị',
    hint: 'Mô tả ngắn',
    icon: 'sparkles',
    group: 'Nhóm',
    when: () => Boolean(currentUser), // tuỳ chọn
    run() { toast('Xin chào!', 'success'); }
  });
})();
```

2. Thêm `<script defer src="assets/js/features/ten-tinh-nang.js"></script>` vào `index.html`
   (sau `features-core.js`, trước `boot.js`).
3. Nếu cần style riêng, thêm vào `assets/css/features.css`.

Tính năng lỗi được cô lập: `CatChat.features.failures()` ghi lại lỗi và phần còn lại của app vẫn chạy.

## Bảo mật

Xem [SECURITY.md](SECURITY.md) để biết chi tiết. Tóm tắt những gì đã có:

- `CatChatGuard` (`assets/js/app/security.js`): token bucket, phạt tăng dần, thử thách proof-of-work.
- `anti-flood.js`: 8 tin/15s, cách nhau 600ms, chặn tin trùng, 12 reaction/10s.
- `login-guard.js`: tối đa 5 lần đăng nhập/phút, khoá 1→30 phút, giữ trạng thái qua localStorage.
- CSP + `referrer` policy trong `index.html`; App Check (tuỳ chọn) trong `assets/js/app/appcheck.js`.

> Chống DDoS thật phải nằm ở hạ tầng (App Check + Rules + quota/budget alert). Lớp phía trình duyệt
> chỉ giảm lạm dụng và bảo vệ trải nghiệm, không thay thế được máy chủ.

## Firebase

- Bật Authentication (Email/Password), Realtime Database và Storage.
- Dán Security Rules cho **Realtime Database** (xem phần Rules trong PR gần nhất) — đây mới là thứ
  quyết định quyền ghi thật, UI chỉ ẩn/hiện nút.
- Ảnh chat và avatar dùng **Storage Rules** riêng, không nằm trong Rules của Realtime Database.
- Tài khoản `admin@com.vn` (hoặc UID có `/admins/<uid> = true`) sẽ thấy bảng quản trị.

## Chạy thử cục bộ

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```
