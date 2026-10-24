# CatChat 🐾

Ứng dụng chat cộng đồng chạy hoàn toàn trên trình duyệt với Firebase (Auth + Realtime Database + Storage).
Trước đây toàn bộ app nằm trong một `index.html`; nay mã nguồn đã được tách thành nhiều file để dễ đọc,
dễ mở rộng và có thể thêm tính năng mới mà không phải sửa code lõi.

## Cấu trúc

```
index.html                     Khung HTML + sprite icon + thứ tự nạp CSS/JS
assets/css/                    Giao diện, tách theo khu vực
  boot.css                     Màn hình chờ (splash) + chuyển cảnh khi mở app
  design-system.css            Design token: spacing, bo góc, chữ, elevation, motion, màu ngữ nghĩa
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
  chat-pro.css                 Nhịp tin nhắn, gộp tin, “Tin nhắn mới”, skeleton, đang nhập…
  cursor-fx.css                Hiệu ứng con trỏ: vệt sáng, sóng khi bấm, dấu chân khi cuộn
  polish.css                   Lớp hoàn thiện thiết kế cho toàn bộ bề mặt (nạp trước halloween-night)
  halloween-night.css          Halloween ma mị (nạp cuối để ghi đè theme Halloween)
  motion.css                   Tuỳ chọn chuyển động (Theo máy / Đầy đủ / Giảm) + guard prefers-reduced-motion
  mobile.css                   Điện thoại, vùng an toàn, bàn phím ảo, màn hình thấp (nạp cuối cùng)
assets/js/app/                 Lõi ứng dụng, nạp theo thứ tự bằng <script defer>
  config.js                    Hằng số, cấu hình Firebase, helper $ / $$
  state.js                     Tham chiếu DOM, tham chiếu Firebase, state dùng chung
  presence.js                  Nguồn duy nhất cho “ai đang trực tuyến”: TTL, nhịp tim, đếm online
  ui-helpers.js                Icon, textElement, avatar, helper quyền/mute
  security.js                  CatChatGuard: rate limit, phạt tăng dần, proof-of-work
  appcheck.js                  Firebase App Check (tuỳ chọn) — chặn bot/script lạ
  theme.js                     Lưu và áp dụng giao diện
  auth.js                      Đăng nhập, đăng ký, đặt lại mật khẩu
  database.js                  subscribe/cleanup realtime, hiển thị lỗi Firebase
  channels.js                  Danh sách kênh, chuyển/tạo kênh, listener tin nhắn
  session.js                   setAdminState, phiên đăng nhập, presence, avatar
  message-format.js            Định dạng thời gian, nhãn ngày, nút trả lời
  messages.js                  Reaction, render tin nhắn (gộp tin, mốc “Tin nhắn mới”),
                               tải thêm lịch sử, tìm kiếm, ghim hiển thị
  composer.js                  Khung soạn tin, gửi tin, gửi thông báo
  message-actions.js           Xoá tin nhắn, dọn kênh
  members.js                   Tab thành viên, danh bạ, hồ sơ, emoji picker
  extras.js                    Tin nhắn đã lưu, sticker, Miu, bộ con trỏ mèo
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
  account-deletion.js          Admin xoá tài khoản thành viên khỏi hệ thống
  boot-screen.js               Tiến trình khởi động thật cho splash (step/finish/fail)
  typing-indicator.js          Chỉ báo “ai đang nhập…” qua node /typing
  motion.js                    Tuỳ chọn chuyển động dùng chung cho CSS + JS
  viewport.js                  Bàn phím ảo, vùng an toàn, đổi kích thước / xoay ngang
  cursor-fx.js                 Hiệu ứng con trỏ: di chuyển, bấm, cuộn (có công tắc Tắt/Nhẹ/Đầy đủ)
functions/                     Cloud Function tuỳ chọn: xoá tài khoản Firebase Auth
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

## Trải nghiệm chat

- **Màn hình chờ có tiến trình thật**: `boot-screen.js` cập nhật từng bước (chuẩn bị giao diện →
  xác thực thiết bị → kết nối Firebase → kiểm tra phiên → tải tin nhắn). Nếu Firefox/Chrome chặn
  hoặc mạng hỏng, splash hiện lỗi kèm nút **Thử lại** thay vì quay vô hạn. Toàn bộ chuyển động
  tôn trọng `prefers-reduced-motion`.
- **Skeleton thay màn hình trống**: trong lúc chờ 100 tin gần nhất, danh sách hiện khung xương
  nhấp nháy (`aria-busy="true"`) rồi mới vẽ nội dung thật.
- **Gộp tin cùng người gửi**: các tin liên tiếp trong 5 phút của cùng một người được gộp (ẩn avatar
  và tên, hiện giờ khi rê chuột) — giống Discord/Slack.
- **Mốc “Tin nhắn mới” + nút nổi**: khi đang xem lại tin cũ, tin mới không kéo bạn xuống đáy;
  một dải “Tin nhắn mới” đánh dấu chỗ bắt đầu và nút `N tin nhắn mới` đưa bạn về cuối.
- **Tải thêm lịch sử**: kênh chỉ nghe 100 tin gần nhất; nút “Tin nhắn cũ hơn” lật thêm 50 tin mỗi lần
  và giữ nguyên vị trí đang đọc.
- **“Đang nhập…”**: ghi trạng thái gõ vào `/typing/<channelId>/<uid>` (tự hết hạn sau 7 giây,
  `onDisconnect` dọn khi đóng tab). Tính năng tự tắt nếu Rules chưa có node `/typing`.

### Rules cho tính năng “đang nhập…”

```json
"typing": {
  ".read": "auth != null",
  "$channelId": {
    "$uid": {
      ".write": "auth != null && !root.child('bans').child(auth.uid).exists() && auth.uid === $uid",
      ".validate": "!newData.exists() || (newData.hasChildren(['name','at']) && newData.child('name').isString() && newData.child('name').val().length <= 60 && newData.child('at').isNumber())"
    }
  }
}
```

## Hệ thống thiết kế

Toàn bộ giao diện dùng chung một bộ token trong `assets/css/design-system.css`:

| Nhóm | Token | Ghi chú |
|---|---|---|
| Khoảng cách | `--ds-space-1..9` | nấc 4/6/8/12/16/20/24/32/44px |
| Bo góc | `--ds-radius-xs..xl`, `--ds-radius-pill` | 8 → 26px |
| Chữ | `--ds-text-2xs..2xl`, `--ds-weight-*` | thang cỡ + độ đậm thống nhất |
| Chuyển động | `--ds-ease-*`, `--ds-dur-*` | 3 nhịp: 140 / 220 / 380ms |
| Độ nổi | `--ds-elev-1..3`, `--ds-inner-light` | có biến thể riêng cho theme tối & Halloween |
| Màu ngữ nghĩa | `--ds-success/-danger/-warning/-info` (+ bản `-soft`) | dùng cho toast, trạng thái, cảnh báo |
| Focus | `--ds-focus` | vòng focus 2 lớp, chỉ hiện với bàn phím |

`assets/css/polish.css` áp token lên **mọi bề mặt**: màn hình đăng nhập, sidebar, topbar, thanh kênh,
danh sách tin nhắn, khung soạn tin, cột thành viên, hộp thoại, hồ sơ, bảng quản trị, tin đã lưu, bảng
lệnh, bảng phím tắt, toast… vì tất cả màu đều lấy từ `--theme-*` nên **5 bảng màu đều đúng**.

Chi tiết đáng chú ý:

- **Sidebar**: vạch nhấn chuyển động ở mục đang chọn, kênh trượt nhẹ khi hover, thẻ hồ sơ có viền riêng.
- **Topbar & thanh kênh**: nền kính mờ (`backdrop-filter`), pill đồng bộ, chấm online có nhịp lan.
- **Tin nhắn**: nhóm nút trả lời/lưu/sao chép/sửa xuất hiện theo cụm khi hover, dải ngày **dính đỉnh**
  khi cuộn, bong bóng có vạch nhấn theo màu theme, reaction nhún khi bấm.
- **Toast**: vạch màu theo loại (thành công/lỗi/thông tin) + thanh đếm ngược 4,8 giây khớp với thời gian
  tự đóng trong `toast()`.
- **Bảng quản trị**: tab có gạch chân trượt, thẻ số liệu nổi nhẹ, nút nguy hiểm đổi sang đỏ khi hover.
- **Khả năng truy cập**: liên kết “Bỏ qua điều hướng” (`ds-skip-link`) đưa focus tới ô soạn tin hoặc ô email,
  vòng focus thống nhất, `prefers-reduced-motion` và `prefers-contrast: more` đều được xử lý.

## Mượt mà & hiệu ứng

**Tải nhanh hơn**
- `preconnect` tới `www.gstatic.com` và `dns-prefetch` cho Auth / Realtime Database / Storage ngay trong
  `<head>` → SDK và dữ liệu tới sớm hơn.
- Splash chỉ dùng `transform` + `opacity` (không còn `filter: blur()` phủ toàn màn hình hay
  `backdrop-filter`), nên không tụt frame trên máy yếu; quầng sáng đổi sang `radial-gradient`.
- Thời gian giữ splash tối thiểu 720ms (trước là 900ms) — vẫn đủ để animation kịp “thở” nhưng không chờ vô ích.
- Ảnh trong tin nhắn có khung chờ nhấp nháy rồi **hiện dần** khi tải xong (không nhảy layout, không khung trống).

**Hiệu ứng con trỏ** (`assets/js/features/cursor-fx.js`)
- **Di chuyển**: vòng sáng bám theo con trỏ (nội suy 24%/frame) + vệt hạt nhỏ.
- **Bấm**: sóng lan + chùm 6 hạt sáng + 2 dấu chân mèo.
- **Cuộn**: dấu chân + vệt sáng trôi ngược hướng cuộn (nghe cả `wheel` lẫn `scroll` của vùng tin nhắn).
- Tối ưu: chỉ `transform`/`opacity`, tối đa 42 hạt cùng lúc, một vòng `requestAnimationFrame` duy nhất và
  tự dừng khi con trỏ ngừng di chuyển; phần tử tái sử dụng bị dọn ngay khi animation kết thúc.
- Tự tắt trên thiết bị cảm ứng, khi người dùng chọn giảm chuyển động, và tự chọn mức **Nhẹ** trên máy
  rất ít RAM (`navigator.deviceMemory` ≤ 1).
- Đổi mức trong **Giao diện → Hiệu ứng con trỏ** (Tắt / Nhẹ / Đầy đủ) hoặc bảng lệnh `Alt + K`
  → “Đổi hiệu ứng con trỏ”. Lựa chọn lưu trên thiết bị.

**Tuỳ chọn chuyển động** (`assets/css/motion.css` + `assets/js/features/motion.js`)
- Nguyên nhân animation “chỉ chạy trên Mac”: Windows → **Cài đặt → Trợ năng → Hiệu ứng hình ảnh** tắt
  khiến trình duyệt báo `prefers-reduced-motion: reduce`, và CSS dừng toàn bộ animation dù máy rất mạnh.
- CatChat tôn trọng cài đặt đó nhưng **không khoá cứng**: `assets/js/features/motion.js` đặt
  `data-motion` trên `<html>` theo 3 mức — `auto` (theo máy, mặc định), `full` (luôn bật), `reduced` (luôn giảm).
- Mọi khối `@media (prefers-reduced-motion: reduce)` trong CSS đều được khoá bằng
  `html:not([data-motion="full"])`, nên chọn “Đầy đủ” là mọi animation chạy lại ngay, không cần đổi cài đặt Windows.
- Đổi trong **Giao diện → Chuyển động** hoặc bảng lệnh `Alt+K` → “Đổi mức chuyển động”; lựa chọn lưu ở
  `localStorage` (`catchat-motion-v1`). Hiệu ứng con trỏ dùng chung lựa chọn này.

## Điện thoại & khi thu nhỏ cửa sổ

`assets/css/mobile.css` (nạp cuối cùng) + `assets/js/features/viewport.js` lo riêng phần này, không đụng
vào 17 file CSS cũ.

- **Vùng an toàn**: tai thỏ / vạch home của iPhone được cộng vào thanh điều hướng dưới đáy, khung soạn
  tin, toast và ngăn kéo thành viên (`env(safe-area-inset-*)` ⇒ biến `--safe-*`).
- **Bàn phím ảo**: `visualViewport` được theo dõi liên tục; `--app-vh` luôn là chiều cao còn thấy được.
  Khi bàn phím mở, thanh điều hướng + dải sticker lùi lại (`html.is-keyboard-open`) để ô soạn tin nằm
  ngay trên bàn phím — trước đây trên iOS ô soạn tin bị bàn phím che.
- **Thu nhỏ / phóng to cửa sổ, xoay ngang**: đổi mức (`phone` / `tablet` / `desktop`) sẽ đóng ngăn kéo
  thành viên và bảng emote đang mở, đưa khung tin nhắn về cuối nếu bạn đang ở gần cuối, và phát sự kiện
  `catchat:viewport-change`. Không còn cảnh ngăn kéo “treo” lại sau khi đổi kích thước.
- **Màn hình thấp** (`max-height: 520px`, điện thoại nằm ngang): thu gọn topbar, thanh kênh và khung soạn
  tin, ẩn dải sticker / gợi ý bàn phím.
- **Nội dung dài**: bong bóng tin nhắn, banner, hồ sơ đều `overflow-wrap: anywhere`; ảnh không tràn ngang.
- **Hộp thoại cuộn được**: hồ sơ, giao diện, xác nhận, cấm chat đều có `max-height: calc(var(--app-vh) - 24px)`
  nên phần thông tin và nút hành động không bị cắt mất trên màn hình nhỏ.
- **Chạm**: `touch-action: manipulation` (bỏ trễ 300ms), nút ≥ 38–42px, không còn flash xám khi bấm.
- **iOS**: chặn tự phóng to khi chạm ô nhập (font 16px, chỉ trong `@supports (-webkit-touch-callout: none)`),
  khoá cuộn trang khi đã vào app để tránh hai thanh cuộn lồng nhau.
- Máy yếu vẫn nhẹ: ở ≤640px mọi `backdrop-filter` đã bị bỏ từ trước, file này không thêm animation mới.

## Trạng thái trực tuyến & hồ sơ thành viên

- `assets/js/app/presence.js` là nguồn duy nhất trả lời “ai đang online” (`isUserOnline`, `onlineMemberCount`).
  Mọi chỗ trước đây đọc thẳng `presence[uid]` (member list, danh bạ, bảng quản trị, command palette) đều
  chuyển sang dùng hàm này.
- `/presence/<uid> = { state: 'online', lastChanged }`; node quá **3 phút** không có nhịp tim bị coi là ngoại
  tuyến, nên đóng tab / mất mạng đột ngột không còn hiện “trực tuyến mãi”. Nhịp tim 60 giây giữ node luôn mới
  (kể cả tab nền bị trình duyệt bóp timer), quét lại mỗi 30 giây để danh sách tự cập nhật khi ai đó hết hạn.
- Chính mình được xác định theo `.info/connected`, nên lần đầu mở app hồ sơ của bạn không còn hiện “Ngoại tuyến”.
- Số “đang trực tuyến” chỉ đếm uid còn trong `/members` ⇒ khớp với danh sách, không còn cộng nhầm tài khoản đã xoá.
- `lastSeen` được ghi khi kết nối, khi rời trang (`pagehide`), khi quay lại tab và tối đa 4 phút một lần.
- Hồ sơ thành viên **vẽ lại được**: mở khi dữ liệu chưa tải xong sẽ hiện “Đang tải hồ sơ…”, rồi tự cập nhật
  ngay khi `/members`, `presence` hoặc email về (trước đây phải đóng rồi mở lại). Nhãn “Hoạt động gần nhất”
  đổi sang dạng tương đối: *Vừa xong · 5 phút trước · 3 giờ trước*, và là “Đang trực tuyến” khi người đó online.
- Không thêm node mới ⇒ **Rules Realtime Database không cần thay đổi**.

## Bảo mật

Xem [SECURITY.md](SECURITY.md) để biết chi tiết. Tóm tắt những gì đã có:

- `CatChatGuard` (`assets/js/app/security.js`): token bucket, phạt tăng dần, thử thách proof-of-work.
- `anti-flood.js`: 8 tin/15s, cách nhau 600ms, chặn tin trùng, 12 reaction/10s.
- `login-guard.js`: tối đa 5 lần đăng nhập/phút, khoá 1→30 phút, giữ trạng thái qua localStorage.
- CSP + `referrer` policy trong `index.html`; App Check (tuỳ chọn) trong `assets/js/app/appcheck.js`.

> Chống DDoS thật phải nằm ở hạ tầng (App Check + Rules + quota/budget alert). Lớp phía trình duyệt
> chỉ giảm lạm dụng và bảo vệ trải nghiệm, không thay thế được máy chủ.

## Xoá tài khoản thành viên (admin)

Vào **hồ sơ thành viên** hoặc **Quản trị → Thành viên** → nút `⛔` (user-x), hoặc bảng lệnh `Alt+K`
→ “Xoá tài khoản thành viên”.

Một lần xoá gồm các bước:

1. Ghi `/deletedUsers/<uid>` — lưu ai xoá ai, lúc nào (chỉ admin đọc được).
2. Ghi `/bans/<uid>` với `deleted: true` — người bị xoá bị **đăng xuất ngay** và không đăng nhập lại được.
3. Xoá `/members/<uid>`, `/memberEmails/<uid>`, `/mutes/<uid>`, reaction của họ trong các tin đang hiển thị;
   tuỳ chọn xoá luôn tin nhắn của họ trong kênh đang mở.
4. Ghi `/adminLog` type `deleteAccount`.
5. (Tuỳ chọn) gọi Cloud Function `deleteUserAccount` để xoá luôn bản ghi **Firebase Authentication**.

> Trình duyệt không thể xoá tài khoản Auth của người khác — cần Admin SDK. Deploy thư mục `functions/`
> rồi đặt `enableAccountDeletionFunction: true` trong `assets/js/app/config.js`, hoặc xoá tay trong
> Firebase Console → Authentication. Xem [functions/README.md](functions/README.md).

Admin không xoá được: chính mình, hoặc một tài khoản đang là admin (phải hạ quyền trước).

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
