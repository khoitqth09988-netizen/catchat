/* CatChat · Điểm khởi động ứng dụng.
   Thứ tự: gắn sự kiện → áp theme → đồng bộ composer → bật các tính năng mở rộng → kết nối Firebase. */
'use strict';

CatChat.bootScreen?.step('Đang chuẩn bị giao diện…', 22);
CatChat.features.start();
attachEvents();
applyTheme(loadSavedTheme(), false);
updateMessageComposer();
CatChat.bootScreen?.step('Đang kết nối tới Firebase…', 34);
initializeFirebase();
