/* CatChat · Feature: định dạng tin nhắn (markdown nhẹ).
   Hỗ trợ **đậm**, *nghiêng*, ~~gạch~~, `mã`, khối ```mã```, ||spoiler|| và liên kết tự động.
   Toàn bộ nội dung được dựng bằng DOM + textContent nên không thể chèn HTML độc hại. */
'use strict';

(() => {
  const TOKEN = /```[\s\S]*?```|`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\|\|[^|\n]+\|\||\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/g;
  const HAS_MARKUP = /[`*~|]|https?:\/\/|www\./;

  function makeLink(raw) {
    const href = raw.startsWith('www.') ? `https://${raw}` : raw;
    let url;
    try {
      url = new URL(href);
    } catch (error) {
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) return null;
    const link = document.createElement('a');
    link.className = 'message-link';
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
    link.textContent = raw;
    link.title = url.href;
    return link;
  }

  function makeCode(token, block) {
    const pre = document.createElement(block ? 'pre' : 'code');
    pre.className = block ? 'message-code-block' : 'message-code';
    const code = document.createElement('code');
    code.textContent = block ? token.slice(3, -3).replace(/^\n+|\n+$/g, '') : token.slice(1, -1);
    pre.appendChild(code);
    return pre;
  }

  function makeInline(tag, token, prefixLength) {
    const element = document.createElement(tag);
    element.textContent = token.slice(prefixLength, -prefixLength);
    return element;
  }

  function makeSpoiler(token) {
    const element = document.createElement('span');
    element.className = 'spoiler';
    element.tabIndex = 0;
    element.setAttribute('role', 'button');
    element.title = 'Bấm để xem nội dung';
    element.textContent = token.slice(2, -2);
    return element;
  }

  function renderInto(element, text) {
    if (!text || !HAS_MARKUP.test(text)) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let match;
    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(text)) !== null) {
      const token = match[0];
      if (match.index > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      let node = null;
      if (token.startsWith('```')) node = makeCode(token, true);
      else if (token.startsWith('`')) node = makeCode(token, false);
      else if (token.startsWith('**')) node = makeInline('strong', token, 2);
      else if (token.startsWith('~~')) node = makeInline('s', token, 2);
      else if (token.startsWith('||')) node = makeSpoiler(token);
      else if (token.startsWith('*') || token.startsWith('_')) node = makeInline('em', token, 1);
      else node = makeLink(token) || document.createTextNode(token);
      fragment.appendChild(node);
      cursor = match.index + token.length;
    }
    if (cursor === 0) return;
    if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
    element.replaceChildren(fragment);
    element.classList.add('message-rich');
  }

  function toggleSpoiler(element) {
    const revealed = element.classList.toggle('revealed');
    element.setAttribute('aria-pressed', String(revealed));
    element.title = revealed ? 'Bấm để ẩn lại' : 'Bấm để xem nội dung';
  }

  CatChat.features.register({
    id: 'rich-text',
    name: 'Định dạng tin nhắn',
    description: 'Đậm, nghiêng, gạch, mã, spoiler và liên kết tự động trong tin nhắn.',
    messageBody(element) {
      renderInto(element, element.textContent || '');
    },
    start() {
      document.addEventListener('click', (event) => {
        const spoiler = event.target instanceof Element ? event.target.closest('.spoiler') : null;
        if (spoiler) toggleSpoiler(spoiler);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const spoiler = event.target instanceof Element ? event.target.closest('.spoiler') : null;
        if (!spoiler) return;
        event.preventDefault();
        toggleSpoiler(spoiler);
      });
    }
  });
})();
