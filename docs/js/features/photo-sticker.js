// 사진 → 스티커 (1단계) + 그림 느낌(만화·수채화·스케치) 고르기
// 홈 메뉴 '그림 스티커'도 같은 화면을 쓰고, 처음 고른 그림 느낌만 다르다.
// 화면 흐름: ① 사진 고르기 → ② 배경 지우는 중 → ③ 꾸미고 보내기(공용 편집 화면)
import { cleanCutout, fitCutout } from '../sticker-render.js';
import { STYLES, stylize } from '../stylize.js';
import { createEditor, el, toast } from '../editor.js';

const MAX_INPUT = 1600; // 큰 사진은 이 크기로 줄여서 처리(속도·메모리)
const MAX_SUBJECT = 720; // 스티커 안에 들어갈 그림의 최대 크기
const THUMB = 150; // 그림 느낌 미리보기 크기

let worker;
let jobId = 0;

function getWorker() {
  if (!worker) worker = new Worker(new URL('../cutout-worker.js', import.meta.url), { type: 'module' });
  return worker;
}

// 배경 제거를 작업 스레드에 맡기고 결과(투명 PNG Blob)를 받는다.
function removeBg(blob, onProgress) {
  const id = ++jobId;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') onProgress(m);
      else {
        w.removeEventListener('message', onMsg);
        if (m.type === 'done') resolve(m.blob);
        else reject(new Error(m.message));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, blob });
  });
}

// 폰 사진은 매우 크므로 미리 줄인다. (사진의 회전 정보도 이때 반영된다)
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX_INPUT / Math.max(bmp.width, bmp.height));
  const c = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
}

export function mount(root, options = {}) {
  const intro = options.style && options.style !== 'photo'
    ? '사진을 고르면 그림처럼 바꿔 드려요.'
    : '사람·반려동물·물건이 크게 나온 사진일수록 잘 돼요.';
  root.innerHTML = `
    <div data-step="pick">
      <p class="lead">사진을 골라 주세요</p>
      <p class="hint">${intro}</p>
      <div class="stack">
        <button class="btn" data-act="camera"><span class="emoji">📷</span>사진 찍기</button>
        <button class="btn secondary" data-act="gallery"><span class="emoji">🖼️</span>갤러리에서 고르기</button>
      </div>
      <input type="file" accept="image/*" capture="environment" data-input="camera" hidden>
      <input type="file" accept="image/*" data-input="gallery" hidden>
      <p class="hint" style="margin-top:20px">🔒 사진은 이 폰 안에서만 처리돼요. 어디에도 올라가지 않아요.</p>
    </div>

    <div data-step="working" hidden>
      <div class="progress-box">
        <div class="spinner"></div>
        <p class="lead" data-msg>배경을 지우는 중이에요…</p>
        <div class="bar"><div data-bar></div></div>
        <p class="hint" data-sub>잠시만 기다려 주세요.</p>
      </div>
    </div>

    <div data-step="edit" hidden></div>
  `;

  const $ = (sel) => root.querySelector(sel);
  const steps = [...root.querySelectorAll('[data-step]')];
  const show = (name) => steps.forEach((s) => { s.hidden = s.dataset.step !== name; window.scrollTo(0, 0); });

  const state = {
    cutout: null, // 배경이 지워진 원본
    style: options.style || 'photo',
    styled: new Map(), // 그림 느낌별 결과 보관(다시 계산하지 않도록)
  };

  function styledCutout() {
    if (!state.cutout) return null;
    if (!state.styled.has(state.style)) state.styled.set(state.style, stylize(state.cutout, state.style));
    return state.styled.get(state.style);
  }

  // 그림 느낌 고르기: 실제 사진으로 만든 작은 미리보기 버튼
  const styleOpt = el(`<div class="opt"><div class="opt-label">그림 느낌</div><div class="styles"></div></div>`);
  const styleButtons = STYLES.map((st) => {
    const b = el(`<button type="button" class="style-btn"><canvas width="${THUMB}" height="${THUMB}"></canvas><span></span></button>`);
    b.querySelector('span').textContent = st.label;
    b.setAttribute('aria-pressed', String(st.id === state.style));
    b.addEventListener('click', async () => {
      styleButtons.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      state.style = st.id;
      await new Promise((r) => setTimeout(r, 0));
      editor.redraw();
    });
    styleOpt.querySelector('.styles').append(b);
    return b;
  });

  function drawStyleThumbs() {
    const small = fitCutout(state.cutout, THUMB - 12);
    STYLES.forEach((st, i) => {
      const c = styleButtons[i].querySelector('canvas');
      const g = c.getContext('2d');
      const img = stylize(small, st.id);
      g.clearRect(0, 0, THUMB, THUMB);
      g.drawImage(img, (THUMB - img.width) / 2, (THUMB - img.height) / 2);
    });
  }

  const editor = createEditor({
    getBase: styledCutout,
    topSlot: styleOpt,
    againLabel: '다른 사진으로 다시 만들기',
    onAgain: () => show('pick'),
  });
  $('[data-step="edit"]').append(editor.root);

  // 사진 고르기
  $('[data-act="camera"]').addEventListener('click', () => $('[data-input="camera"]').click());
  $('[data-act="gallery"]').addEventListener('click', () => $('[data-input="gallery"]').click());
  for (const input of root.querySelectorAll('input[type=file]')) {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (file) start(file);
    });
  }

  async function start(file) {
    show('working');
    const bar = $('[data-bar]');
    const sub = $('[data-sub]');
    bar.style.width = '5%';
    sub.textContent = '잠시만 기다려 주세요.';
    try {
      const small = await shrink(file);
      const blob = await removeBg(small, ({ key, current, total }) => {
        if (key.startsWith('fetch')) {
          // 처음 한 번은 AI 모델(약 45MB)을 받아서 폰에 보관한다
          sub.textContent = '처음 한 번만 준비 파일을 받고 있어요. (와이파이 권장)';
          bar.style.width = `${5 + Math.round((current / Math.max(1, total)) * 60)}%`;
        } else if (key.startsWith('compute')) {
          sub.textContent = '거의 다 됐어요!';
          bar.style.width = `${65 + Math.round((current / Math.max(1, total)) * 35)}%`;
        }
      });
      const bmp = await createImageBitmap(blob);
      state.cutout = fitCutout(cleanCutout(bmp), MAX_SUBJECT);
      bmp.close();
      state.styled.clear();
      if (state.style !== 'photo') sub.textContent = '그림으로 바꾸는 중이에요…';
      bar.style.width = '100%';
      await new Promise((r) => setTimeout(r, 30)); // 글자가 화면에 먼저 보이도록
      editor.reset();
      drawStyleThumbs();
      show('edit');
    } catch (err) {
      console.error(err);
      show('pick');
      toast('앗, 사진을 처리하지 못했어요. 다른 사진으로 다시 해 주세요.');
    }
  }
}
