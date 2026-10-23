/* CatChat · Lõi hệ thống tính năng (feature registry + hook).
   Mỗi tính năng là một file riêng trong assets/js/features/ và tự đăng ký vào đây.
   Hook cho phép tính năng mở rộng app mà không phải sửa code lõi:
     start           — chạy một lần khi app khởi động
     outgoingText    — chỉnh/sửa/chặn nội dung trước khi gửi tin nhắn
     messageTools    — thêm nút vào thanh công cụ của từng tin nhắn
     memberActions   — thêm hành động vào hồ sơ thành viên
     keydown         — bắt phím tắt toàn cục (trả về true để chặn xử lý mặc định)
   Tính năng lỗi sẽ chỉ bị tắt riêng nó, phần còn lại của CatChat vẫn chạy. */
'use strict';

const CatChat = window.CatChat || (window.CatChat = {});

const FEATURE_HOOKS = ['start', 'outgoingText', 'messageTools', 'memberActions', 'keydown'];
const featureRegistry = [];
const featureHooks = new Map(FEATURE_HOOKS.map((name) => [name, []]));
const featureFailures = [];

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
  if (args.length > 1) {
    handlers.forEach(({ featureId, handler }) => {
      try {
        handler(...args);
      } catch (error) {
        reportFeatureFailure(featureId, hookName, error);
      }
    });
    return args[0];
  }
  let current = args[0];
  handlers.forEach(({ featureId, handler }) => {
    try {
      const next = handler(current);
      if (next !== undefined && next !== null) current = next;
    } catch (error) {
      reportFeatureFailure(featureId, hookName, error);
    }
  });
  return current;
}

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
