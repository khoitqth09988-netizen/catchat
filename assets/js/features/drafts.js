/* CatChat · Feature: bản nháp theo kênh.
   Nội dung đang gõ được lưu riêng cho từng kênh (localStorage) và tự khôi phục khi quay lại.
   Không gửi gì lên Firebase — nháp chỉ nằm trên thiết bị này. */
'use strict';

(() => {
  const STORAGE_KEY = 'catchat-drafts-v1';
  const MAX_DRAFTS = 40;

  let store = {};
  let pending = {};
  let saveTimer = null;
  let chip = null;

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeStore() {
    try {
      const keys = Object.keys(store);
      if (keys.length > MAX_DRAFTS) keys.slice(0, keys.length - MAX_DRAFTS).forEach((key) => { delete store[key]; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      // Hết dung lượng hoặc chế độ riêng tư: bỏ qua, nháp chỉ là tiện ích.
    }
  }

  function keyFor(channelId = activeChannelId) {
    return `${currentUser?.uid || 'guest'}::${channelId || 'general'}`;
  }

  function showChip(label) {
    if (!chip) return;
    chip.textContent = label;
    chip.hidden = !label;
  }

  /** Gộp các giá trị đang gõ (bộ nhớ) vào kho nháp và ghi xuống localStorage. */
  function flush() {
    const keys = Object.keys(pending);
    if (!keys.length) return;
    keys.forEach((key) => {
      const value = pending[key];
      if (value && value.trim()) store[key] = value.slice(0, 800);
      else delete store[key];
      delete pending[key];
    });
    writeStore();
  }

  function trackInput() {
    if (!currentUser || !els.messageInput) return;
    const value = els.messageInput.value;
    pending[keyFor()] = value;
    showChip(value.trim() ? 'Bản nháp đã lưu trên thiết bị' : '');
  }

  function saveDraft() {
    if (!currentUser || !els.messageInput) return;
    pending[keyFor()] = els.messageInput.value;
    flush();
  }

  function scheduleSave() {
    trackInput();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flush, 500);
  }

  function restoreDraft(channelId) {
    if (!currentUser || !els.messageInput) return;
    if (els.messageInput.value.trim()) return;
    const draft = store[keyFor(channelId)] || pending[keyFor(channelId)];
    if (!draft) {
      showChip('');
      return;
    }
    els.messageInput.value = draft;
    els.messageInput.setSelectionRange(draft.length, draft.length);
    updateMessageComposer();
    showChip('Đã khôi phục bản nháp của kênh này');
    toast(`Đã khôi phục bản nháp trong #${channelNameFor(channelId)}.`, 'info');
  }

  function clearCurrentDraft() {
    const key = keyFor();
    delete store[key];
    delete pending[key];
    writeStore();
    if (els.messageInput) els.messageInput.value = '';
    updateMessageComposer();
    showChip('Đã xoá bản nháp của kênh này');
    window.setTimeout(() => showChip(''), 2200);
  }

  function hasDraft() {
    return Boolean(currentUser && (store[keyFor()] || pending[keyFor()]));
  }

  CatChat.features.register({
    id: 'drafts',
    name: 'Bản nháp theo kênh',
    description: 'Lưu và khôi phục nội dung đang gõ cho từng kênh, ngay trên thiết bị này.',
    start() {
      store = readStore();
      const hint = els.messageForm?.querySelector('.composer-hint') || document.querySelector('.composer-hint');
      if (hint) {
        chip = document.createElement('span');
        chip.className = 'draft-chip';
        chip.id = 'draftChip';
        chip.hidden = true;
        chip.setAttribute('aria-live', 'polite');
        hint.appendChild(chip);
      }
      els.messageInput.addEventListener('input', scheduleSave);
      CatChat.actions.register({
        id: 'draft-clear',
        label: 'Xoá bản nháp của kênh này',
        hint: 'Bỏ nội dung đang gõ dở trong kênh hiện tại',
        icon: 'trash',
        group: 'Bản nháp',
        when: hasDraft,
        run() {
          clearCurrentDraft();
        }
      });
      CatChat.actions.register({
        id: 'draft-save',
        label: 'Lưu bản nháp ngay',
        hint: 'Lưu nội dung đang gõ cho kênh này',
        icon: 'check',
        group: 'Bản nháp',
        when: () => Boolean(currentUser && els.messageInput?.value.trim()),
        run() {
          scheduleSave();
          window.clearTimeout(saveTimer);
          saveDraft();
          toast('Đã lưu bản nháp của kênh này.', 'success');
        }
      });
      window.addEventListener('beforeunload', saveDraft);
      document.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-clear-draft]') : null;
        if (button) clearCurrentDraft();
      });
    },
    channelChanged(channelId) {
      // Lõi đã xoá ô nhập trước khi gọi hook, nên chỉ ghi những gì đang giữ trong bộ nhớ.
      flush();
      restoreDraft(channelId);
    },
    keydown(event) {
      // Trên một số bàn phím Android / bộ gõ tiếng Việt, sự kiện keydown có thể
      // không kèm event.key (IME trả mã 229) ⇒ phải đọc an toàn, nếu không sẽ
      // ném TypeError mỗi lần gõ phím.
      if (event.isComposing) return false;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key !== 'd' || !event.altKey || event.ctrlKey || event.metaKey) return false;
      const target = event.target;
      const typing = target instanceof Element && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (typing) return false;
      event.preventDefault();
      clearCurrentDraft();
      return true;
    }
  });
})();
