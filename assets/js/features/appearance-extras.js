/* CatChat · Feature: tuỳ chỉnh thêm giao diện.
   Thêm vào hộp thoại "Bộ lông của CatChat": màu nhấn, cỡ chữ và mật độ hiển thị.
   Mọi lựa chọn lưu trên thiết bị này (localStorage), không ảnh hưởng người khác. */
'use strict';

(() => {
  const STORAGE_KEY = 'catchat-appearance-v1';

  const ACCENTS = [
    { id: 'default', label: 'Mặc định', color: '' },
    { id: 'orange', label: 'Cam bí ngô', color: '#ff8a2b', deep: '#c4531a' },
    { id: 'violet', label: 'Tím mộng', color: '#9b6bff', deep: '#6234c9' },
    { id: 'rose', label: 'Hồng đào', color: '#f4699a', deep: '#c23b6c' },
    { id: 'mint', label: 'Bạc hà', color: '#3ec9a3', deep: '#1c8f74' },
    { id: 'sky', label: 'Xanh trời', color: '#4da3ff', deep: '#2268c4' },
    { id: 'lemon', label: 'Chanh mật', color: '#e8c33a', deep: '#b5931f' }
  ];
  const TEXT_SCALES = [
    { id: 'small', label: 'Nhỏ' },
    { id: 'normal', label: 'Vừa' },
    { id: 'large', label: 'Lớn' }
  ];
  const DENSITIES = [
    { id: 'cozy', label: 'Thoải mái' },
    { id: 'compact', label: 'Gọn' }
  ];

  let settings = { accent: 'default', textScale: 'normal', density: 'cozy' };

  function readSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        accent: ACCENTS.some((item) => item.id === parsed.accent) ? parsed.accent : 'default',
        textScale: TEXT_SCALES.some((item) => item.id === parsed.textScale) ? parsed.textScale : 'normal',
        density: DENSITIES.some((item) => item.id === parsed.density) ? parsed.density : 'cozy'
      };
    } catch (error) {
      return { accent: 'default', textScale: 'normal', density: 'cozy' };
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      // Chế độ riêng tư: bỏ qua.
    }
  }

  function applyAccent(accentId) {
    const accent = ACCENTS.find((item) => item.id === accentId) || ACCENTS[0];
    const body = document.body;
    if (!accent.color) {
      body.style.removeProperty('--theme-accent');
      body.style.removeProperty('--cat-gradient');
      body.style.removeProperty('--cat-glow');
    } else {
      body.style.setProperty('--theme-accent', accent.color);
      body.style.setProperty('--cat-gradient', `linear-gradient(140deg, ${accent.color}, ${accent.deep})`);
      body.style.setProperty('--cat-glow', `${accent.color}44`);
    }
    body.dataset.accent = accent.id;
  }

  function applyAll() {
    applyAccent(settings.accent);
    document.body.dataset.textScale = settings.textScale;
    document.body.dataset.density = settings.density;
  }

  function makeSegmented(label, options, value, onPick, dataKey) {
    const row = document.createElement('div');
    row.className = 'appearance-row';
    const name = document.createElement('span');
    name.className = 'appearance-label';
    name.textContent = label;
    const group = document.createElement('div');
    group.className = 'appearance-segmented';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.dataset[dataKey] = option.id;
      button.setAttribute('aria-pressed', String(option.id === value));
      button.classList.toggle('selected', option.id === value);
      button.addEventListener('click', () => {
        group.querySelectorAll('button').forEach((item) => {
          const active = item === button;
          item.classList.toggle('selected', active);
          item.setAttribute('aria-pressed', String(active));
        });
        onPick(option.id);
      });
      group.appendChild(button);
    });
    row.append(name, group);
    return row;
  }

  CatChat.features.register({
    id: 'appearance-extras',
    name: 'Tuỳ chỉnh giao diện nâng cao',
    description: 'Màu nhấn, cỡ chữ và mật độ tin nhắn, lưu riêng trên thiết bị.',
    start() {
      settings = readSettings();
      applyAll();
      CatChat.actions.register({
        id: 'appearance-reset',
        label: 'Đặt lại tuỳ chỉnh giao diện',
        hint: 'Màu nhấn, cỡ chữ và mật độ về mặc định',
        icon: 'palette',
        group: 'Giao diện',
        run() {
          settings = { accent: 'default', textScale: 'normal', density: 'cozy' };
          persist();
          applyAll();
          toast('Đã đặt lại tuỳ chỉnh giao diện.', 'success');
        }
      });
    },
    themeExtras(container) {
      const accentRow = document.createElement('div');
      accentRow.className = 'appearance-row';
      const accentLabel = document.createElement('span');
      accentLabel.className = 'appearance-label';
      accentLabel.textContent = 'Màu nhấn';
      const swatches = document.createElement('div');
      swatches.className = 'appearance-swatches';
      swatches.setAttribute('role', 'group');
      swatches.setAttribute('aria-label', 'Chọn màu nhấn');
      ACCENTS.forEach((accent) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `accent-swatch${accent.id === 'default' ? ' is-default' : ''}${settings.accent === accent.id ? ' selected' : ''}`;
        button.dataset.accentChoice = accent.id;
        button.title = accent.label;
        button.setAttribute('aria-label', accent.label);
        button.setAttribute('aria-pressed', String(settings.accent === accent.id));
        if (accent.color) button.style.setProperty('--swatch', accent.color);
        button.addEventListener('click', () => {
          settings.accent = accent.id;
          persist();
          applyAccent(accent.id);
          swatches.querySelectorAll('button').forEach((item) => {
            const active = item === button;
            item.classList.toggle('selected', active);
            item.setAttribute('aria-pressed', String(active));
          });
        });
        swatches.appendChild(button);
      });
      accentRow.append(accentLabel, swatches);

      container.append(
        accentRow,
        makeSegmented('Cỡ chữ', TEXT_SCALES, settings.textScale, (value) => {
          settings.textScale = value;
          persist();
          document.body.dataset.textScale = value;
        }, 'textScale'),
        makeSegmented('Mật độ tin nhắn', DENSITIES, settings.density, (value) => {
          settings.density = value;
          persist();
          document.body.dataset.density = value;
        }, 'density')
      );
    }
  });
})();
