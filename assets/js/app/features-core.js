/* CatChat · Lõi hệ thống tính năng (feature registry + hook).
   Mỗi tính năng là một file riêng trong assets/js/features/ và tự đăng ký vào đây.
   Hook cho phép tính năng mở rộng app mà không phải sửa code lõi:
     start           — chạy một lần khi app khởi động
     outgoingText    — chỉnh/sửa/chặn nội dung trước khi gửi tin nhắn
     messageBody     — định dạng, tô màu, chèn liên kết cho nội dung tin nhắn
     incomingMessage — biết có tin nhắn mới vừa tới (thông báo, âm thanh, highlight)
     channelChanged  — chạy sau khi chuyển kênh (khôi phục bản nháp, cuộn, ...)
     messageTools    — thêm nút vào thanh công cụ của từng tin nhắn
     memberActions   — thêm hành động vào hồ sơ thành viên
     themeExtras     — thêm điều khiển vào hộp thoại giao diện
     guardWrite      — chặn một thao tác ghi (reaction, ...) bằng cách trả về true
     keydown         — bắt phím tắt toàn cục (trả về true để chặn xử lý mặc định)
   Tính năng lỗi sẽ chỉ bị tắt riêng nó, phần còn lại của CatChat vẫn chạy. */
'use strict';

const CatChat = window.CatChat || (window.CatChat = {});

const FEATURE_HOOKS = [
  'start',
  'outgoingText',
  'messageBody',
  'incomingMessage',
  'channelChanged',
  'messageTools',
  'memberActions',
  'themeExtras',
  'guardWrite',
  'keydown'
];
const featureRegistry = [];
const featureHooks = new Map(FEATURE_HOOKS.map((name) => [name, []]));
const featureFailures = [];
const CHAINED_HOOKS = new Set(['outgoingText']);

function reportFeatureFailure(featureId, hookName, error) {
  featureFailures.push({ featureId, hookName, message: String(error?.message || error) });
  console.warn(`CatChat feature "${featureId}" lỗi ở hook ${hookName}:`, error);
}

function registerFeature(feature) {
  const id = String(feature?.id || '').trim();
  if (!id) throw new Error('Tính năng phải có id.');
  if (featureRegistry.some((item) => item.id === id)) throw new Error(`Tính năng "${id}" đã được đăng ký.`);
  const entry = { id, name: String(feature.name || id), description: String(feature.description || ''), hooks: {}, started: false };
  FEATURE_HOOKS.forEach((hookName) => {
    const handler = feature[hookName];
    if (typeof handler !== 'function') return;
    entry.hooks[hookName] = handler;
    featureHooks.get(hookName).push({ featureId: id, handler });
  });
  featureRegistry.push(entry);
  return entry;
}

/**
 * Chạy tuần tự mọi handler của một hook.
 * - Hook một tham số (outgoingText, keydown, memberActions): handler có thể trả về giá trị mới
 *   và giá trị đó được chuyển cho handler kế tiếp.
 * - Hook nhiều tham số (messageTools(container, context)): mọi handler nhận cùng bộ tham số.
 * Lỗi của một tính năng không làm hỏng các tính năng còn lại.
 */
function runFeatureHook(hookName, ...args) {
  const handlers = featureHooks.get(hookName);
  if (!handlers || !handlers.length) return args[0];
  // Chỉ hook một tham số dạng "payload" mới nối tiếp kết quả của nhau.
  const chained = args.length === 1 && CHAINED_HOOKS.has(hookName);
  let current = args[0];
  let handled = false;
  handlers.forEach(({ featureId, handler }) => {
    try {
      const result = handler(...(chained ? [current] : args));
      if (result === true) handled = true;
      if (chained && result !== undefined && result !== null) current = result;
    } catch (error) {
      reportFeatureFailure(featureId, hookName, error);
    }
  });
  if (chained) return current;
  return handled ? true : args[0];
}

/* ── Thanh hành động dùng chung ────────────────────────────────────────────
   Tính năng đăng ký hành động ở đây để bảng lệnh nhanh (Alt+K) và các nơi khác
   dùng lại mà không cần biết hành động đó thuộc tính năng nào. */
const sharedActions = [];

function registerAction(action) {
  const id = String(action?.id || '').trim();
  if (!id) throw new Error('Hành động phải có id.');
  const entry = {
    id,
    label: String(action.label || id),
    hint: String(action.hint || ''),
    icon: String(action.icon || 'sparkles'),
    group: String(action.group || 'Hành động'),
    when: typeof action.when === 'function' ? action.when : null,
    run: action.run
  };
  const index = sharedActions.findIndex((item) => item.id === id);
  if (index >= 0) sharedActions[index] = entry;
  else sharedActions.push(entry);
  return entry;
}

function listActions() {
  return sharedActions.filter((action) => {
    if (!action.when) return true;
    try {
      return Boolean(action.when());
    } catch (error) {
      return false;
    }
  });
}

CatChat.actions = { register: registerAction, list: listActions };

CatChat.features = {
  register: registerFeature,
  run: runFeatureHook,
  list: () => featureRegistry.map(({ id, name, description, hooks }) => ({ id, name, description, hooks: Object.keys(hooks) })),
  failures: () => featureFailures.slice(),
  start() {
    featureRegistry.forEach((entry) => {
      if (entry.started || typeof entry.hooks.start !== 'function') return;
      entry.started = true;
      try {
        entry.hooks.start();
      } catch (error) {
        reportFeatureFailure(entry.id, 'start', error);
      }
    });
    return featureRegistry.length;
  }
};
