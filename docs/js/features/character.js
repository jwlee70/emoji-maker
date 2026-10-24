// 캐릭터 꾸미기: ① 내 캐릭터 만들기(처음 한 번, 폰에 보관) → ② 표정 고르기 → ③ 꾸미고 보내기(공용 편집 화면)
// 그림: DiceBear 'Big Smile' 그림체 (그림 CC BY 4.0 Ashley Seo / 코드 MIT) — 폰 안에서 그린다.
import { createAvatar, bigSmile } from '../../vendor/dicebear.mjs';
import { fitCutout } from '../sticker-render.js';
import { createEditor, chips, el } from '../editor.js';

const STORE_KEY = 'emoji-maker.character';

const HAIRS = [
  ['bunHair', '똥머리'], ['straightHair', '긴 생머리'], ['wavyBob', '웨이브 단발'], ['curlyBob', '곱슬 단발'],
  ['bangs', '앞머리'], ['braids', '땋은 머리'], ['froBun', '뽀글 똥머리'], ['shortHair', '짧은 머리'],
  ['curlyShortHair', '곱슬 짧은'], ['bowlCutHair', '바가지'], ['mohawk', '닭벼슬'], ['halfShavedHead', '반삭'],
  ['shavedHead', '삭발'],
];
const HAIR_COLORS = ['220f00', '3a1a00', '71472d', 'a55728', 'e2ba87', 'd56c0c', 'f28fad', '605de4'];
const SKINS = ['ffe4c0', 'f5d7b1', 'efcc9f', 'e2ba87', 'c99c62', 'a47539', '8c5a2b', '643d19'];
const ACCESSORIES = [
  ['', '없음'], ['catEars', '고양이 귀'], ['glasses', '안경'], ['sunglasses', '선글라스'], ['sailormoonCrown', '왕관'],
];

// 표정 세트: 눈·입 모양 + 기본 글자 + 기본 도장(위치는 스티커 800×800 기준)
const EXPRESSIONS = [
  { label: '기뻐요', eyes: 'cheery', mouth: 'openedSmile', text: '좋아요!', stamps: [{ ch: '✨', x: 640, y: 150 }] },
  { label: '고마워', eyes: 'cheery', mouth: 'kawaii', text: '고마워♡', stamps: [{ ch: '🌸', x: 640, y: 160 }] },
  { label: '사랑해', eyes: 'starstruck', mouth: 'kawaii', text: '사랑해', stamps: [{ ch: '❤️', x: 640, y: 150 }, { ch: '❤️', x: 150, y: 220, size: 90 }] },
  { label: '화이팅', eyes: 'winking', mouth: 'teethSmile', text: '화이팅!', stamps: [{ ch: '🔥', x: 640, y: 160 }] },
  { label: '최고', eyes: 'starstruck', mouth: 'gapSmile', text: '최고!', stamps: [{ ch: '👍', x: 650, y: 170 }] },
  { label: '슬퍼요', eyes: 'sad', mouth: 'openSad', text: '힝…', stamps: [{ ch: '💧', x: 620, y: 170 }] },
  { label: '미안해', eyes: 'sad', mouth: 'kawaii', text: '미안해', stamps: [{ ch: '💦', x: 640, y: 160 }] },
  { label: '화났어', eyes: 'angry', mouth: 'unimpressed', text: '흥!', stamps: [{ ch: '💢', x: 630, y: 160 }] },
  { label: '졸려', eyes: 'sleepy', mouth: 'unimpressed', text: '졸려…', stamps: [{ ch: '💤', x: 640, y: 150 }] },
  { label: '응?', eyes: 'confused', mouth: 'kawaii', text: '응?', stamps: [{ ch: '❓', x: 640, y: 150 }] },
  { label: '놀랐어', eyes: 'normal', mouth: 'openSad', text: '헉!', stamps: [{ ch: '❗', x: 640, y: 150 }] },
];

const DEFAULT_CHAR = { hair: 'bunHair', hairColor: '3a1a00', skin: 'f5d7b1', acc: '' };

function loadChar() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY));
    if (v && v.hair) return { ...DEFAULT_CHAR, ...v };
  } catch { /* 저장 공간을 못 쓰는 경우 무시 */ }
  return null;
}
function saveChar(c) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch { /* 무시 */ }
}

function avatarUri(c, eyes = 'cheery', mouth = 'openedSmile') {
  return createAvatar(bigSmile, {
    seed: 'me',
    size: 512,
    hair: [c.hair],
    hairColor: [c.hairColor],
    skinColor: [c.skin],
    accessories: c.acc ? [c.acc] : [],
    accessoriesProbability: c.acc ? 100 : 0,
    eyes: [eyes],
    mouth: [mouth],
  }).toDataUri();
}

// 그림(SVG)을 투명 배경 캔버스로 바꾸고 여백을 잘라낸다
async function avatarCanvas(c, eyes, mouth) {
  const img = new Image();
  img.src = avatarUri(c, eyes, mouth);
  await img.decode();
  const cv = new OffscreenCanvas(720, 720);
  cv.getContext('2d').drawImage(img, 0, 0, 720, 720);
  return fitCutout(cv, 720);
}

export function mount(root) {
  root.innerHTML = `
    <div data-step="build" hidden>
      <p class="lead">내 캐릭터를 만들어요</p>
      <div class="char-preview"><img data-big alt="내 캐릭터"></div>
      <div class="opt"><div class="opt-label">머리 모양</div><div class="pick-grid" data-hair></div></div>
      <div class="opt"><div class="opt-label">머리 색</div><div class="chips" data-hair-color></div></div>
      <div class="opt"><div class="opt-label">피부 색</div><div class="chips" data-skin></div></div>
      <div class="opt"><div class="opt-label">소품</div><div class="pick-grid" data-acc></div></div>
      <div class="stack">
        <button class="btn" data-act="done"><span class="emoji">✔️</span>이 캐릭터로 할래요</button>
      </div>
    </div>

    <div data-step="set" hidden>
      <p class="lead">오늘 기분은 어때요?</p>
      <div class="expr-grid" data-exprs></div>
      <div class="stack">
        <button class="btn secondary" data-act="change"><span class="emoji">✏️</span>캐릭터 고치기</button>
      </div>
      <p class="footnote">캐릭터 그림: “Big Smile” by Ashley Seo (CC BY 4.0), DiceBear로 그림</p>
    </div>

    <div data-step="edit" hidden></div>
  `;
  const $ = (sel) => root.querySelector(sel);
  const steps = [...root.querySelectorAll('[data-step]')];
  const show = (name) => { steps.forEach((s) => { s.hidden = s.dataset.step !== name; }); window.scrollTo(0, 0); };

  let char = loadChar();
  const draft = { ...(char || DEFAULT_CHAR) };
  let base = null; // 편집 중인 표정 그림

  // ── ① 캐릭터 만들기 ──
  const hairBtns = HAIRS.map(([id, label]) => pickButton(label, () => { draft.hair = id; refreshBuild(); }));
  hairBtns.forEach((b) => $('[data-hair]').append(b));
  const accBtns = ACCESSORIES.map(([id, label]) => pickButton(label, () => { draft.acc = id; refreshBuild(); }));
  accBtns.forEach((b) => $('[data-acc]').append(b));
  const colorChip = (label) => (b, v) => {
    b.className = 'chip swatch';
    b.setAttribute('aria-label', label);
    b.innerHTML = `<span style="background:#${v}"></span>`;
  };
  chips($('[data-hair-color]'), HAIR_COLORS, draft.hairColor, (v) => { draft.hairColor = v; refreshBuild(); }, colorChip('머리 색'));
  chips($('[data-skin]'), SKINS, draft.skin, (v) => { draft.skin = v; refreshBuild(); }, colorChip('피부 색'));

  function pickButton(label, onClick) {
    const b = el(`<button type="button" class="style-btn"><img alt=""><span></span></button>`);
    b.querySelector('span').textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // 미리보기와 모든 선택 버튼 그림을 지금 고른 모습으로 다시 그린다
  function refreshBuild() {
    $('[data-big]').src = avatarUri(draft);
    HAIRS.forEach(([id], i) => {
      hairBtns[i].querySelector('img').src = avatarUri({ ...draft, hair: id });
      hairBtns[i].setAttribute('aria-pressed', String(draft.hair === id));
    });
    ACCESSORIES.forEach(([id], i) => {
      accBtns[i].querySelector('img').src = avatarUri({ ...draft, acc: id });
      accBtns[i].setAttribute('aria-pressed', String(draft.acc === id));
    });
  }

  $('[data-act="done"]').addEventListener('click', () => {
    char = { ...draft };
    saveChar(char);
    refreshSet();
    show('set');
  });

  // ── ② 표정 고르기 ──
  const exprBtns = EXPRESSIONS.map((ex) => {
    const b = el(`<button type="button" class="expr-card"><img alt=""><span></span></button>`);
    b.querySelector('span').textContent = ex.label;
    b.addEventListener('click', () => openEditor(ex));
    $('[data-exprs]').append(b);
    return b;
  });
  function refreshSet() {
    EXPRESSIONS.forEach((ex, i) => { exprBtns[i].querySelector('img').src = avatarUri(char, ex.eyes, ex.mouth); });
  }
  $('[data-act="change"]').addEventListener('click', () => { Object.assign(draft, char); refreshBuild(); show('build'); });

  // ── ③ 꾸미고 보내기 ──
  const editor = createEditor({
    getBase: () => base,
    againLabel: '다른 표정 고르기',
    onAgain: () => show('set'),
  });
  $('[data-step="edit"]').append(editor.root);

  async function openEditor(ex) {
    base = await avatarCanvas(char, ex.eyes, ex.mouth);
    editor.reset({ text: ex.text, stamps: ex.stamps });
    show('edit');
  }

  // 처음이면 만들기부터, 만든 적 있으면 바로 표정 고르기
  if (char) { refreshSet(); show('set'); } else { refreshBuild(); show('build'); }
}
