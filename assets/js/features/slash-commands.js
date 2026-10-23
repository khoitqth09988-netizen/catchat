/* CatChat · Feature: slash commands.
   Gõ "/" trong khung soạn tin để dùng lệnh nhanh: /me, /shrug, /flip, /table, /8ball, /cat, /roll, /help.
   Tính năng chặn gửi khi lệnh không tồn tại, và hiện gợi ý ngay trên khung soạn tin. */
'use strict';

(() => {
  const PICK = (list) => list[Math.floor(Math.random() * list.length)];

  const COMMANDS = [
    {
      name: '/help',
      usage: '/help',
      summary: 'Xem danh sách lệnh',
      run() {
        toast(`Lệnh khả dụng: ${COMMANDS.filter((item) => item.name !== '/help').map((item) => item.usage).join(' · ')}`, 'info');
        return { cancel: true };
      }
    },
    {
      name: '/me',
      usage: '/me <hành động>',
      summary: 'Kể hành động ở ngôi thứ ba',
      template: '/me ',
      run(rest) {
        if (!rest) return { cancel: true, error: 'Dùng: /me đang uống trà sữa' };
        const me = displayNameFor(currentUser) || 'Mèo nào đó';
        return { text: `*${me}* ${rest}` };
      }
    },
    {
      name: '/shrug',
      usage: '/shrug',
      summary: 'Thêm ¯\\_(ツ)_/¯',
      run: (rest) => ({ text: `${rest ? `${rest} ` : ''}¯\\_(ツ)_/¯` })
    },
    {
      name: '/flip',
      usage: '/flip',
      summary: 'Lật bàn (╯°□°)╯︵ ┻━┻',
      run: () => ({ text: '(╯°□°)╯︵ ┻━┻' })
    },
    {
      name: '/table',
      usage: '/table',
      summary: 'Dựng bàn lại ┬─┬ノ( º _ ºノ)',
      run: () => ({ text: '┬─┬ノ( º _ ºノ)' })
    },
    {
      name: '/8ball',
      usage: '/8ball <câu hỏi>',
      summary: 'Hỏi bóng thần mèo',
      template: '/8ball ',
      run(rest) {
        if (!rest) return { cancel: true, error: 'Dùng: /8ball tối nay có nên ngủ sớm?' };
        const answers = ['Chắc chắn rồi 🐾', 'Có vẻ là vậy', 'Hỏi lại sau nhé', 'Đừng mơ 🐈', 'Mèo nghĩ là nên thử', 'Chưa chắc đâu', 'Theo mèo là được đó'];
        return { text: `🎱 ${rest} → ${PICK(answers)}` };
      }
    },
    {
      name: '/cat',
      usage: '/cat',
      summary: 'Một sự thật về mèo',
      run() {
        const facts = [
          'Mèo có thể tạo ra hơn 100 âm thanh khác nhau, chó chỉ khoảng 10.',
          'Mèo dành khoảng 70% cuộc đời để ngủ.',
          'Râu mèo giúp chúng đo khoảng cách khi di chuyển trong bóng tối.',
          'Mèo đổ mồ hôi qua… bàn chân.',
          'Nhịp tim của mèo khoảng 140–220 lần mỗi phút.',
          'Mèo có thể nhảy cao gấp 5 lần chiều cao của mình.'
        ];
        return { text: `🐱 ${PICK(facts)}` };
      }
    },
    {
      name: '/roll',
      usage: '/roll [số mặt]',
      summary: 'Tung xúc xắc, mặc định 6 mặt',
      run(rest) {
        const sides = Math.min(1000, Math.max(2, Number.parseInt(rest, 10) || 6));
        return { text: `🎲 ${Math.floor(Math.random() * sides) + 1} / ${sides}` };
      }
    }
  ];

  const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.name, command]));
  let hint = null;
  let hintOptions = [];

  function matches(value) {
    const keyword = value.trim().toLowerCase();
    if (!keyword.startsWith('/')) return [];
    if (keyword.includes(' ')) return [];
    return COMMANDS.filter((command) => command.name.startsWith(keyword.split(' ')[0]));
  }

  function renderHint() {
    if (!hint) return;
    const value = els.messageInput.value;
    hintOptions = matches(value);
    if (!hintOptions.length) {
      hint.hidden = true;
      hint.replaceChildren();
      return;
    }
    const fragment = document.createDocumentFragment();
    hintOptions.forEach((command) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slash-hint-item';
      button.dataset.slashCommand = command.name;
      const name = document.createElement('strong');
      name.textContent = command.usage;
      const summary = document.createElement('span');
      summary.textContent = command.summary;
      button.append(name, summary);
      fragment.appendChild(button);
    });
    hint.replaceChildren(fragment);
    hint.hidden = false;
  }

  function handleCommand(text) {
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return null;
    const [rawName] = trimmed.split(/\s+/);
    const command = COMMAND_MAP.get(rawName.toLowerCase());
    if (!command) {
      toast(`Không có lệnh "${rawName}". Gõ /help để xem danh sách.`, 'error');
      return { cancel: true };
    }
    const rest = trimmed.slice(rawName.length).trim();
    const result = command.run(rest) || {};
    if (result.error) toast(result.error, 'error');
    if (result.cancel) return { cancel: true };
    return result.text ? { text: result.text } : { cancel: true };
  }

  CatChat.features.register({
    id: 'slash-commands',
    name: 'Lệnh gạch chéo',
    description: 'Gõ / để chèn nhanh nội dung hoặc chặn tin nhắn không hợp lệ.',
    start() {
      hint = document.createElement('div');
      hint.className = 'slash-hint';
      hint.id = 'slashHint';
      hint.hidden = true;
      hint.setAttribute('role', 'listbox');
      hint.setAttribute('aria-label', 'Gợi ý lệnh');
      const composer = els.messageInput.closest('form') || els.messageInput.parentElement;
      composer.parentElement.insertBefore(hint, composer);

      hint.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-slash-command]') : null;
        if (!button) return;
        const command = COMMAND_MAP.get(button.dataset.slashCommand);
        if (!command) return;
        els.messageInput.value = command.template || command.name;
        hint.hidden = true;
        els.messageInput.focus();
        updateMessageComposer();
      });

      els.messageInput.addEventListener('input', renderHint);
      els.messageInput.addEventListener('blur', () => window.setTimeout(() => { if (hint) hint.hidden = true; }, 140));
      els.messageInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || !hintOptions.length || !hint || hint.hidden) return;
        event.preventDefault();
        els.messageInput.value = hintOptions[0].template || hintOptions[0].name;
        hint.hidden = true;
        updateMessageComposer();
      });
    },
    outgoingText(payload) {
      if (payload.announcement) return payload;
      const result = handleCommand(payload.text || '');
      if (!result) return payload;
      if (result.cancel) return { ...payload, cancel: true };
      return { ...payload, text: result.text };
    }
  });
})();
