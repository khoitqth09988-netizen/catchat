/* CatChat · Điểm khởi động ứng dụng.
   Thứ tự: gắn sự kiện → áp theme → đồng bộ composer → bật các tính năng mở rộng → kết nối Firebase. */
'use strict';

CatChat.features.start();
attachEvents();
applyTheme(loadSavedTheme(), false);
updateMessageComposer();
initializeFirebase();
