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
  cat-skin.css                 Lớp da “tổ mèo”: bong bóng, Miu, con trỏ mèo
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
  compact.css                  Bố cục gọn kiểu Discord: mật độ dày, bớt blur diện tích lớn
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
  extras.js                    Tin nhắn đã lưu, Miu, bộ con trỏ mèo
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
  account-deletion.js          Admin xoá tài khoản thành viên (có hàm purge dùng lại được)
  identity-guard.js            Dấu vân tay thiết bị/IP, chặn vĩnh viễn, giới hạn 2 tài khoản mỗi máy
  identity-blocks.js           Tab quản trị “Chặn vĩnh viễn” (thiết bị / IP / khoá tự động)
  name-guard.js                Giữ chỗ tên hiển thị duy nhất (/displayNames), gợi ý tên thay thế
  boot-screen.js               Tiến trình khởi động thật cho splash (step/finish/fail)
  typing-indicator.js          Chỉ báo “ai đang nhập…” qua node /typing
  motion.js                    Tuỳ chọn chuyển động dùng chung cho CSS + JS
  viewport.js                  Bàn phím ảo, vùng an toàn, đổi kích thước / xoay ngang
  cursor-fx.js                 Hiệu ứng con trỏ: di chuyển, bấm, cuộn (có công tắc Tắt/Nhẹ/Đầy đủ)
  pwa.js                       Đăng ký Service Worker + manifest (cài như app)
  media.js                     Trạng thái Storage: có thì upload, không thì dán liên kết ảnh
functions/                     Cloud Functions: xoá tài khoản Auth, lấy mã IP, tự khoá định danh
  package.json                 Khai báo phụ thuộc + engines Node 22 (bắt buộc để deploy được)
storage.rules                  Storage Rules cho ảnh chat + avatar (dán riêng trong Console)
database.rules.json            Bản Rules Realtime Database đầy đủ (dán vào Firebase Console)
manifest.webmanifest           PWA: tên, icon, màu, chế độ standalone
sw.js                          Service Worker: shell network-first, cache-bust theo VERSION
assets/icons/                  Icon PWA 192/512/maskable + apple-touch-icon
scripts/verify.mjs             Kiểm tra trước khi deploy (chạy: node scripts/verify.mjs)
tests/                         rules.test.mjs (mô phỏng Rules) + smoke.test.mjs (jsdom)
.github/workflows/deploy.yml   CI: kiểm tra tĩnh, deploy Firebase Hosting nếu có secret
SECURITY.md                    Checklist bảo mật: App Check, Rules, quota, CSP
ROADMAP.md                     Lộ trình full stack: đã xong gì, còn gì
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

## Menu hành động của tin nhắn (⋯)

Mỗi tin nhắn có **một** nút `⋯` nằm ngay sau tên và giờ gửi. Bấm vào mở menu gồm:

| Mục | Quyền |
|---|---|
| Trả lời | mọi thành viên |
| Lưu / Bỏ lưu | mọi thành viên |
| Sao chép nội dung | mọi thành viên (từ hook `messageTools`) |
| Sửa tin nhắn | chủ tin nhắn (hoặc admin) |
| Ghim / Bỏ ghim | admin |
| Xoá tin nhắn | chủ tin nhắn (hoặc admin) |

Hàng meta vì thế chỉ còn **tên → giờ → ⋯**: tên luôn sát avatar, không còn icon rời.
Menu mở **ngay cạnh tin nhắn**: bên phải hàng tin nếu còn chỗ, hết chỗ thì sang bên trái,
màn hình hẹp mới rơi xuống dưới nút (và lật lên trên nếu sát đáy). Toạ độ luôn được kẹp trong khung nhìn.
Menu đóng khi chọn một mục, bấm ra ngoài, nhấn `Esc`, cuộn danh sách hoặc xoay/đổi kích thước cửa sổ.
Trên cảm ứng (≤ 760px) nút `⋯` luôn hiện và mục cao 38px cho dễ bấm. Các nút bên trong vẫn giữ `data-*` cũ nên handler uỷ quyền trong `events.js` không đổi —
feature thêm nút mới chỉ cần mount vào container `context.container` như trước.

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

- **Vùng an toàn**: tai thỏ (cả phía trên) và vạch home của iPhone được cộng vào thanh trên, thanh điều
  hướng dưới đáy, khung soạn tin, toast và ngăn kéo (`env(safe-area-inset-*)` ⇒ biến `--safe-*`).
  Cần thiết vì `index.html` dùng `viewport-fit=cover` + status bar `black-translucent`: khi cài PWA,
  nội dung sẽ chạm mép trên nếu không cộng `--safe-top`.
- **Bàn phím ảo**: `visualViewport` được theo dõi liên tục; `--app-vh` luôn là chiều cao còn thấy được.
  Khi bàn phím mở, thanh điều hướng lùi lại (`html.is-keyboard-open`) để ô soạn tin nằm
  ngay trên bàn phím — trước đây trên iOS ô soạn tin bị bàn phím che.
- **Thu nhỏ / phóng to cửa sổ, xoay ngang**: đổi mức (`phone` / `tablet` / `desktop`) sẽ đóng ngăn kéo
  thành viên và bảng emote đang mở, đưa khung tin nhắn về cuối nếu bạn đang ở gần cuối, và phát sự kiện
  `catchat:viewport-change`. Không còn cảnh ngăn kéo “treo” lại sau khi đổi kích thước.
- **Màn hình thấp** (`max-height: 520px`, điện thoại nằm ngang): thu gọn topbar, thanh kênh và khung soạn
  tin, ẩn gợi ý bàn phím.
- **Nội dung dài**: bong bóng tin nhắn, banner, hồ sơ đều `overflow-wrap: anywhere`; ảnh không tràn ngang.
- **Hộp thoại cuộn được**: hồ sơ, giao diện, xác nhận, cấm chat đều có `max-height: calc(var(--app-vh) - 24px)`
  nên phần thông tin và nút hành động không bị cắt mất trên màn hình nhỏ.
- **Chạm**: `touch-action: manipulation` (bỏ trễ 300ms), không còn flash xám khi bấm. Trên mọi thiết bị
  không có chuột (`hover: none` / `pointer: coarse`): nút `⋯` **luôn hiện** (kể cả iPad 768–1080px,
  trước đây bị vô hình), mục menu hành động cao **44px**, nút gửi 44px, nút đính kèm/emote 42px;
  vùng bấm của `⋯` được nới bằng pseudo-element nên không làm xê dịch hàng tên.
- **Cỡ chữ**: ≤760px, nội dung tin nhắn 15px (thay vì 13,5px), tên 13,5px, giờ gửi 11,5px,
  gợi ý soạn tin 10,5px, ô soạn tin 16px. Tuỳ chọn Giao diện → Cỡ chữ vẫn ghi đè được.
- **Bàn phím mobile**: ô soạn tin có `enterkeyhint="send"` + `autocapitalize="sentences"`, các ô tìm kiếm
  có `enterkeyhint="search"`; iOS không còn tự phóng to khi chạm ô nhập (font 16px trong
  `@supports (-webkit-touch-callout: none)`, áp cho cả màn hình ≤760px kể cả iPhone nằm ngang).
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

## Chặn vĩnh viễn & giới hạn 2 tài khoản mỗi thiết bị/IP

Ba lớp chặn, tất cả đều **vĩnh viễn cho tới khi quản trị viên gỡ**:

| Lớp | Node | Ai ghi | Hiệu lực |
|---|---|---|---|
| Tài khoản | `/bans/<uid>` (`permanent: true`) | admin | chặn ngay khi đăng nhập, listener đá ra tức thì |
| Thiết bị | `/deviceBans/<deviceHash>` | admin | chặn trước khi vào app, kể cả tài khoản mới |
| IP | `/ipBans/<ipHash>` | admin | như trên (cần Cloud Function để biết IP) |

- **Mã thiết bị** = băm SHA-256 của dấu vân tay trình duyệt + UUID lưu trong `localStorage`
  (`catchat-device-id-v1`). Mở hồ sơ thành viên (vai trò admin) sẽ thấy **Mã thiết bị / Mã IP** kèm nút sao chép.
- **Mã IP** chỉ có khi triển khai `functions/getClientIdentity` và bật `enableIdentityFunction: true`
  trong `config.js`. Không có hàm này thì app vẫn chặn theo thiết bị, chỉ là không chặn được IP.
- **Giới hạn 2 tài khoản**: mỗi lần đăng nhập, `/identityLedger/<deviceHash>/<uid>` và
  `/identityIpLedger/<ipHash>/<uid>` được ghi lại. Khi một định danh có **quá 2 uid**, hệ thống:
  1. tạo `/identityLocks/<hash>` = `{ kind, reason, uids }` → mọi tài khoản trong đó bị chặn vào app;
  2. cấm `/bans/<uid>` (nếu phiên hiện tại là admin) và dọn dữ liệu hồ sơ;
  3. phiên đang dùng bị đăng xuất ngay kèm thông báo lý do.
  Đã deploy `onIdentityLedgerWrite` thì bước này chạy ở **máy chủ**, tự xoá cả Firebase Auth.
- Tab **Quản trị → Chặn vĩnh viễn** liệt kê 3 danh sách trên, thêm chặn tay bằng mã, bỏ chặn, và nút
  “Xoá toàn bộ tài khoản trong khoá”. Hồ sơ thành viên có thêm nút **Cấm vĩnh viễn (tài khoản + thiết bị + IP)**.

> Giới hạn cần biết: dấu vân tay trình duyệt có thể đổi (xoá dữ liệu, ẩn danh, đổi máy) và IP công cộng
> chỉ đọc được ở server. Đây là lớp giảm lạm dụng, **không phải** bằng chứng tuyệt đối — chặn thật phải
> dựa vào Firebase Rules + App Check + Cloud Function (xem `SECURITY.md`).

## Tên hiển thị là duy nhất

Mỗi tên chỉ thuộc về một người. Khi đăng ký, tên được chuẩn hoá rồi “giữ chỗ” trong
`/displayNames/<slug> = <uid>` bằng transaction, nên hai người bấm cùng lúc cũng chỉ một người thắng:

| Tên nhập | slug |
|---|---|
| `Mèo Con` | `meo-con` |
| `mèo   con` | `meo-con` |
| `Đường` | `duong` |

- Trùng tên ⇒ tài khoản vừa tạo bị xoá ngay, form gợi ý `Tên 2` và báo lỗi rõ ràng.
- Người đã có tài khoản (dữ liệu cũ trùng tên) vẫn đăng nhập được: giữ tên cũ của chính mình,
  nếu chưa có tên thì thêm hậu tố `(abcd)` để không hiển thị trùng người khác.
- Khi tên đổi, khoá tên cũ được dọn tự động (`forgetOtherSlugs`).
- Cần node `displayNames` trong Rules (đã có trong cả hai file Rules); thiếu node thì app **không**
  chặn đăng nhập mà chỉ cảnh báo trong console.

> Rules không chuẩn hoá được chuỗi (không có `toLowerCase`), nên slug do trình duyệt tính. Đây là lớp
> chặn trùng tên cho luồng bình thường; muốn chặn tuyệt đối phải dùng Cloud Function.

## Xoá kênh

Quản trị viên mở kênh rồi bấm nút **xoá kênh** (biểu tượng `#` gạch chéo) trên thanh tiêu đề kênh:
xác nhận + lý do → app dọn `channelMessages/<id>` (kèm reaction), `pins`, `locks`, `typing`, rồi xoá
`channels/<id>`. Mọi người đang ở trong kênh đó được tự chuyển về `#phòng-chung`.

- Thứ tự quan trọng: tin nhắn bị xoá **trước** khi kênh biến mất, vì Rules xoá tin nhắn yêu cầu
  `/channels/<id>` còn tồn tại.
- Kênh hệ thống `#phòng-chung` và `#thông-báo` không xoá được (cả ở UI lẫn Rules).
- Hành động được ghi vào `/adminLog` với số tin nhắn đã xoá kèm lý do.

## Bố cục gọn kiểu Discord

`assets/css/compact.css` (nạp sau `polish.css`, trước `mobile.css`) chỉnh **mật độ**, không đổi bảng màu:

- Sidebar 228px, thanh trên 58px, thanh kênh 54px, danh sách thành viên 264px — mắt đọc nhanh hơn.
- Bong bóng tin nhắn 7×10px, avatar 28px, khoảng cách giữa tin 8px, gộp tin liền mạch chặt hơn.
- Khung soạn tin thấp hơn (textarea tối đa 96px), nhãn gợi ý nhỏ lại; emote chèn qua nút 🙂 trên thanh soạn.
- Bỏ `backdrop-filter` ở sidebar (diện tích lớn, tốn GPU nhất khi cuộn) và giảm blur thanh trên.
- Chuyển cảnh ngắn hơn (~0.22s / 0.13s) để cảm giác phản hồi nhanh, vẫn tôn trọng tuỳ chọn giảm chuyển động.

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

## Không có Firebase Storage (gói miễn phí)

Dự án vẫn chạy đủ tính năng chat khi chưa bật Storage:

- **Gửi ảnh**: bấm nút đính kèm → app hỏi **liên kết ảnh https://** thay vì mở hộp chọn tệp.
  Ảnh chỉ là URL công khai lưu trong `imageURL` của tin nhắn (≤ 4096 ký tự, Rules cho phép),
  **không upload gì lên Firebase** nên không cần Storage, không tốn quota.
- **Ảnh đại diện**: dùng chữ cái đầu của tên (avatar chữ) — không cần Storage.
- Nếu lỡ bật Storage sau này, app tự nhận và quay lại luồng chọn tệp bình thường; khi gặp lỗi
  kiểu `storage/bucket-not-found`, app tự chuyển sang chế độ liên kết và báo một lần.
- `storage.rules` trong repo để dành cho lúc bật Storage; **không dán cũng không sao** —
  chỉ ảnh upload mới cần tới nó.

## Firebase

- Bật Authentication (Email/Password), Realtime Database và Storage.
- Dán Security Rules cho **Realtime Database** — đây mới là thứ quyết định quyền ghi thật, UI chỉ ẩn/hiện nút.
  Mở [`database.rules.json`](database.rules.json) → copy **toàn bộ file** → dán vào Console → Realtime Database
  → Rules → Publish. Đây là bộ Rules duy nhất của dự án:

  - gốc **đóng** (`".read": false`, `".write": false`), mở quyền theo từng node;
  - 24 node, gồm cả `displayNames`, `pins`, `locks`, `typing`, `mutes`, `adminLog`, `deletedUsers`
    và 6 node định danh (`memberIdentity`, `identityLedger`, `identityIpLedger`, `deviceBans`, `ipBans`, `identityLocks`);
  - admin = `/admins/<uid> = true` ∨ `auth.token.email === 'admin@com.vn'` ∨ `auth.token.admin === true`.

> ⚠️ Không tự thêm quyền ở gốc. Nếu gốc mở (`"true"`), người bị cấm tự xoá được `/bans/<uid>`,
> `/deviceBans/<mã>`, `/identityLocks/<mã>` và tự thêm mình vào `/admins` — mọi lớp chặn thành hình thức.
> Node `/admins` chỉ admin hiện tại ghi được; tài khoản quản trị đầu tiên đặt tay trong Console
> (Console bỏ qua Rules).
- Ảnh chat và avatar dùng **Storage Rules** riêng, không nằm trong Rules của Realtime Database.
  Mở [`storage.rules`](storage.rules) → copy **toàn bộ file** → Console → Storage → Rules → Publish.
  Chỉ chủ tài khoản ghi được vào `chatImages/<uid>/…` (≤ 5 MB) và `avatars/<uid>/…` (≤ 8 MB),
  `contentType` phải là `image/*`; mọi đường dẫn khác bị chặn.
- `/adminLog` là **append-only**: admin chỉ `push` được mục mới, không xoá/sửa. Nút “Dọn nhật ký”
  trong bảng quản trị chỉ ghi thêm một dấu `log-purge` để ẩn mục cũ khỏi giao diện — bản ghi gốc
  vẫn còn để kiểm toán.
- Tin nhắn: Rules đối chiếu `name` với `/members/<uid>/name` và đòi `timestamp` không lệch quá
  5 phút so với giờ máy chủ ⇒ không giả danh admin, không đẩy tin lên đầu bằng timestamp tương lai.
- Tài khoản `admin@com.vn` (hoặc UID có `/admins/<uid> = true`) sẽ thấy bảng quản trị.

## Chạy thử cục bộ

Chỉ xem giao diện (vẫn cần Internet cho Firebase SDK):

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Kiểm tra toàn bộ mã trước khi commit (không cần cài gì):

```bash
node scripts/verify.mjs
# · tham chiếu tài nguyên trong index.html
# · node --check cho 45+ tệp JS (kể cả functions/, sw.js)
# · CSS cân bằng ngoặc · JSON hợp lệ · icon PWA · Rules gốc đóng, không numChildren()
```

### Kiểm thử tự động (không cần Firebase thật)

```bash
node scripts/verify.mjs        # cú pháp JS/CSS/JSON, tài nguyên, PWA, Rules tĩnh
node tests/rules.test.mjs      # mô phỏng Rules: 27 tình huống quyền ghi
cd tests && npm install && npm test   # thêm smoke test giao diện bằng jsdom
```

- `tests/rules.test.mjs` dịch biểu thức trong `database.rules.json` sang JS rồi chạy:
  giả danh admin, giả uid, timestamp tương lai, sửa/xoá tin người khác, adminLog append-only,
  khách chưa đăng nhập, kênh không tồn tại… Không cần Emulator, chạy trong ~0,1 giây.
- `tests/smoke.test.mjs` dựng lại `index.html` trong bộ nhớ (CSS/JS thật + Firebase giả **không có
  Storage**) để kiểm menu `⋯`, phân quyền admin/thường, thông báo toàn máy chủ, chế độ dán ảnh
  bằng liên kết, gửi tin kèm `imageURL`, và bắt lỗi runtime.
- `tests/mobile.test.mjs` tự đánh giá `@media` + specificity trên 19 tệp CSS ở 3 khổ màn hình
  (390px cảm ứng, 820px iPad, 1280px chuột) để chắc rằng rule mobile **thực sự thắng**:
  chữ tin nhắn 15px, ô soạn tin 16px, mục menu 44px, nút `⋯` hiện trên iPad, desktop không đổi.
- Cả ba chạy tự động trong GitHub Actions (`.github/workflows/deploy.yml`): job **Kiểm tra tĩnh**
  chạy `verify` + `rules`, job **Smoke test giao diện** cài jsdom rồi chạy `smoke`.

### Firebase Emulator (chạy full stack ở máy)

```bash
npm install -g firebase-tools
firebase emulators:start            # auth 9099 · database 9000 · storage 9199 · UI 4000
firebase emulators:start --only auth,database,storage,hosting
```

`firebase.json` đã khai báo đủ cổng. Muốn app nói chuyện với emulator, thêm một lần trong Console
của trình duyệt (chỉ khi phát triển):

```js
firebase.database().useEmulator('localhost', 9000);
firebase.auth().useEmulator('http://localhost:9099');
firebase.storage().useEmulator('localhost', 9199);
```

### Cloud Functions

```bash
cd functions
npm install            # firebase-admin + firebase-functions, engines Node 22
npm run check          # node --check index.js
cd ..
firebase deploy --only functions
```

Deploy xong thì bật trong `assets/js/app/config.js`:
`enableAccountDeletionFunction: true` (xoá tài khoản Auth) và `enableIdentityFunction: true`
(lấy IP thật cho giới hạn thiết bị/IP).

### PWA

- `manifest.webmanifest` + `sw.js` đã có sẵn: mở bằng HTTPS (GitHub Pages/Firebase Hosting) là
  cài được lên màn hình chính/desktop.
- Trang, JS và CSS tải **network-first** ⇒ deploy xong là thấy bản mới ngay (tên tệp không có hash);
  ảnh/icon dùng stale-while-revalidate; **không** cache dữ liệu Firebase.
- Khi sửa nhiều tệp tĩnh và muốn xoá cache cũ ngay, tăng `VERSION` trong `sw.js` (`catchat-v1` →
  `catchat-v2`).

### CI/CD

`.github/workflows/deploy.yml` chạy `node scripts/verify.mjs` cho mọi push/PR vào `main`.
Muốn tự deploy Firebase Hosting: tạo secret `FIREBASE_SERVICE_ACCOUNT` (JSON của service account
có quyền Firebase Hosting Admin). Không có secret thì job deploy được bỏ qua, GitHub Pages vẫn phục vụ
nhánh `main` như trước.

> Rules và Functions **không** tự deploy trong CI: chủ dự án dán Rules tay trong Console để kiểm soát
> từng thay đổi, và deploy Functions bằng lệnh ở trên.
