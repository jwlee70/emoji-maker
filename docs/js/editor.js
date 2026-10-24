// 스티커 편집 화면(공용): 미리보기 · 꾸미기 도장 · 테두리 · 글자 · 보내기/저장.
// 사진 스티커와 캐릭터 꾸미기가 같이 쓴다.
import { renderSticker, SIZE } from './sticker-render.js';
import { shareOrSave, save } from './share.js';

const OUTLINES = [
  { label: '없음', value: 0 },
  { label: '얇게', value: 0.012 },
  { label: '보통', value: 0.022 },
  { label: '두껍게', value: 0.035 },
];
const OUTLINE_COLORS = ['#ffffff', '#2b2230', '#ffd84d', '#ff9ab5', '#8fd3ff'];
const TEXT_COLORS = ['#2b2230', '#ff5c8a', '#ffffff', '#3b82f6', '#22a35a'];
export const STAMPS = ['❤️', '✨', '💧', '💦', '💢', '💤', '❓', '❗', '👍', '🌸', '🎵', '🔥'];
const STAMP_SIZE = 130;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg) {
  const t = el(`<div class="toast" role="status"></div>`);
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3000);
}

// 여러 개 중 하나를 고르는 버튼 줄
export function chips(container, items, initial, onPick, render) {
  container.innerHTML = '';
  const buttons = items.map((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    render(b, item);
    b.setAttribute('aria-pressed', String(item === initial));
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      onPick(item);
    });
    container.append(b);
    return b;
  });
  return buttons;
}

const swatch = (label) => (b, v) => {
  b.className = 'chip swatch';
  b.setAttribute('aria-label', label);
  b.innerHTML = `<span style="background:${v}"></span>`;
};

/**
 * @param {object} o
 * @param {() => OffscreenCanvas} o.getBase 배경이 투명한 그림
 * @param {HTMLElement} [o.topSlot] 미리보기 바로 아래에 넣을 추가 영역(예: 그림 느낌 고르기)
 * @param {string} o.againLabel 맨 아래 버튼 글자
 * @param {() => void} o.onAgain
 */
export function createEditor({ getBase, topSlot, againLabel, onAgain }) {
  const root = el(`
    <div>
      <div class="preview"><canvas data-canvas width="${SIZE}" height="${SIZE}"></canvas></div>
      <div data-top></div>
      <div class="stack">
        <button class="btn" data-act="share"><span class="emoji">💬</span>카톡으로 보내기</button>
      </div>
      <div class="opt">
        <div class="opt-label">꾸미기 도장 <small class="opt-sub">누르면 붙고, 손가락으로 옮겨요</small></div>
        <div class="chips stamps" data-stamps></div>
        <div class="chips" data-stamp-tools style="margin-top:10px">
          <button type="button" class="chip" data-tool="smaller">작게</button>
          <button type="button" class="chip" data-tool="bigger">크게</button>
          <button type="button" class="chip" data-tool="remove">도장 지우기</button>
        </div>
      </div>
      <div class="opt">
        <div class="opt-label">테두리</div>
        <div class="chips" data-outline></div>
        <div class="chips" data-outline-color style="margin-top:10px"></div>
      </div>
      <div class="opt">
        <div class="opt-label">글자 넣기 (안 넣어도 돼요)</div>
        <input class="text-input" data-text maxlength="12" placeholder="예) 고마워♡" enterkeyhint="done">
        <div class="chips" data-text-color style="margin-top:10px"></div>
      </div>
      <div class="stack">
        <button class="btn secondary" data-act="save"><span class="emoji">⬇️</span>폰에 저장하기</button>
        <button class="btn ghost" data-act="again"></button>
      </div>
    </div>
  `);
  const $ = (sel) => root.querySelector(sel);
  if (topSlot) $('[data-top]').append(topSlot);
  $('[data-act="again"]').textContent = againLabel;

  const state = {
    outline: OUTLINES[2],
    outlineColor: OUTLINE_COLORS[0],
    text: '',
    textColor: TEXT_COLORS[0],
    stamps: [], // { ch, x, y, size } — 스티커(800×800) 좌표
    selected: -1,
    sticker: null, // 도장을 뺀 스티커 그림
  };

  const canvas = $('[data-canvas]');
  const ctx = canvas.getContext('2d');

  function drawStamps(g, highlight) {
    state.stamps.forEach((s, i) => {
      g.save();
      g.font = `${s.size}px ${EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,255,255,0.95)';
      g.shadowBlur = 8;
      g.fillText(s.ch, s.x, s.y);
      g.fillText(s.ch, s.x, s.y);
      g.restore();
      if (highlight && i === state.selected) {
        g.save();
        g.setLineDash([10, 8]);
        g.lineWidth = 4;
        g.strokeStyle = '#ff7a9c';
        g.beginPath();
        g.arc(s.x, s.y, s.size * 0.65, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    });
    canvas.classList.toggle('dragging-ok', state.stamps.length > 0);
  }

  function paint() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (state.sticker) ctx.drawImage(state.sticker, 0, 0);
    drawStamps(ctx, true);
  }

  function redraw() {
    const base = getBase();
    if (!base) return;
    state.sticker = renderSticker(base, {
      outline: state.outline.value,
      outlineColor: state.outlineColor,
      text: state.text,
      textColor: state.textColor,
    });
    paint();
  }

  async function exportBlob() {
    const out = new OffscreenCanvas(SIZE, SIZE);
    const g = out.getContext('2d');
    g.drawImage(state.sticker, 0, 0);
    drawStamps(g, false);
    return out.convertToBlob({ type: 'image/png' });
  }

  // 옵션 버튼들
  chips($('[data-outline]'), OUTLINES, state.outline, (v) => { state.outline = v; redraw(); },
    (b, v) => { b.className = 'chip'; b.textContent = v.label; });
  chips($('[data-outline-color]'), OUTLINE_COLORS, state.outlineColor, (v) => { state.outlineColor = v; redraw(); }, swatch('테두리 색'));
  chips($('[data-text-color]'), TEXT_COLORS, state.textColor, (v) => { state.textColor = v; redraw(); }, swatch('글자 색'));
  const textInput = $('[data-text]');
  textInput.addEventListener('input', () => { state.text = textInput.value; redraw(); });
  textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') textInput.blur(); });

  // 꾸미기 도장
  for (const ch of STAMPS) {
    const b = el(`<button type="button" class="chip stamp"></button>`);
    b.textContent = ch;
    b.addEventListener('click', () => {
      // 겹치지 않게 조금씩 비켜서 붙인다
      const n = state.stamps.length;
      state.stamps.push({ ch, x: SIZE * 0.72 - (n % 3) * 60, y: SIZE * 0.22 + (n % 3) * 50, size: STAMP_SIZE });
      state.selected = state.stamps.length - 1;
      paint();
    });
    $('[data-stamps]').append(b);
  }
  $('[data-stamp-tools]').addEventListener('click', (e) => {
    const tool = e.target.dataset && e.target.dataset.tool;
    const s = state.stamps[state.selected];
    if (!tool || !s) return;
    if (tool === 'smaller') s.size = Math.max(50, s.size * 0.8);
    if (tool === 'bigger') s.size = Math.min(400, s.size * 1.25);
    if (tool === 'remove') {
      state.stamps.splice(state.selected, 1);
      state.selected = state.stamps.length - 1;
    }
    paint();
  });

  // 손가락으로 도장 옮기기
  let drag = null;
  const toSticker = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toSticker(e);
    for (let i = state.stamps.length - 1; i >= 0; i--) {
      const s = state.stamps[i];
      if (Math.hypot(p.x - s.x, p.y - s.y) < s.size * 0.7) {
        state.selected = i;
        drag = { i, dx: s.x - p.x, dy: s.y - p.y };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        paint();
        return;
      }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toSticker(e);
    const s = state.stamps[drag.i];
    s.x = Math.min(SIZE, Math.max(0, p.x + drag.dx));
    s.y = Math.min(SIZE, Math.max(0, p.y + drag.dy));
    paint();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // 보내기 / 저장
  $('[data-act="share"]').addEventListener('click', async () => {
    const result = await shareOrSave(await exportBlob());
    if (result === 'saved') toast('보내기가 안 되는 브라우저라 폰에 저장했어요. 카톡에서 사진으로 보내 주세요.');
  });
  $('[data-act="save"]').addEventListener('click', async () => {
    save(await exportBlob());
    toast('저장했어요! 갤러리의 "Download" 앨범에 있어요.');
  });
  $('[data-act="again"]').addEventListener('click', onAgain);

  return {
    root,
    redraw,
    /** 새 그림을 열 때: 글자·도장을 정해 준 값으로 초기화(테두리 설정은 유지) */
    reset({ text = '', stamps = [] } = {}) {
      state.text = text;
      textInput.value = text;
      state.stamps = stamps.map((s) => ({ size: STAMP_SIZE, ...s }));
      state.selected = state.stamps.length - 1;
      redraw();
    },
  };
}
