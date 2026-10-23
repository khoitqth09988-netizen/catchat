/* CatChat · Feature: sao chép & lọc tin nhắn.
   - Nút "sao chép" trên mọi tin nhắn có chữ (dùng hook messageTools).
   - Hành động "Tìm tin nhắn trong kênh" trong hồ sơ thành viên (hook memberActions). */
'use strict';

(() => {
  function copyText(text) {
    const value = String(text || '');
    if (!value) return Promise.resolve(false);
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }
    area.remove();
    return Promise.resolve(ok);
  }

  CatChat.features.register({
    id: 'copy-message',
    name: 'Sao chép tin nhắn',
    description: 'Sao chép nhanh nội dung một tin nhắn vào clipboard.',
    messageTools(container, context) {
      const text = String(context?.data?.text || '');
      if (!text) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-tool';
      button.dataset.copyMessage = context.id;
      button.title = 'Sao chép nội dung';
      button.setAttribute('aria-label', 'Sao chép nội dung tin nhắn');
      button.appendChild(icon('copy'));
      container.appendChild(button);
    },
    memberActions({ addAction, name }) {
      addAction('Tìm tin nhắn trong kênh này', '', 'search', () => {
        closeMemberProfile();
        setWorkspaceView('chat');
        if (els.messageSearchBar.hidden) setMessageSearchOpen(true);
        els.messageSearchInput.value = name;
        messageSearchQuery = name;
        renderAllMessages(true);
      });
    },
    start() {
      document.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-copy-message]') : null;
        if (!button) return;
        const data = messageDataById(button.dataset.copyMessage);
        if (!data) {
          toast('Tin nhắn này không còn trong danh sách gần đây.', 'info');
          return;
        }
        copyText(data.text).then((ok) => {
          toast(ok ? 'Đã sao chép tin nhắn.' : 'Trình duyệt chặn sao chép. Hãy bôi đen và copy thủ công.', ok ? 'success' : 'error');
        });
      });
    }
  });
})();
