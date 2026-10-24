// 앱 뼈대: 홈 메뉴와 화면 전환(#주소로 이동해서 폰의 '뒤로' 버튼이 동작하게 함).
// 새 기능을 추가할 때는 FEATURES 에 한 줄 넣고 js/features/ 에 모듈을 만든다.
// 모듈은 mount(sectionElement) 함수를 내보내면 된다.

const FEATURES = [
  { id: 'photo', emoji: '📸', title: '사진으로 스티커', desc: '사진 배경을 지우고 스티커로', module: './features/photo-sticker.js' },
  { id: 'text', emoji: '💬', title: '글자 이모티콘', desc: '곧 나와요' },
  { id: 'gif', emoji: '🎞️', title: '움직이는 스티커', desc: '곧 나와요' },
  { id: 'character', emoji: '🧸', title: '캐릭터 꾸미기', desc: '곧 나와요' },
];

const app = document.getElementById('app');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const mounted = new Map();

function renderMenu() {
  const menu = document.getElementById('menu');
  for (const f of FEATURES) {
    const b = document.createElement('button');
    b.className = 'menu-card';
    b.disabled = !f.module;
    b.innerHTML = `<span class="emoji">${f.emoji}</span><span>${f.title}<small>${f.desc}</small></span>`;
    b.addEventListener('click', () => { location.hash = '#/' + f.id; });
    menu.append(b);
  }
}

async function route() {
  const id = location.hash.replace('#/', '');
  const feature = FEATURES.find((f) => f.id === id && f.module);
  for (const s of app.querySelectorAll('[data-screen]')) s.hidden = true;

  if (!feature) {
    app.querySelector('[data-screen="home"]').hidden = false;
    titleEl.textContent = '나만의 스티커';
    backBtn.hidden = true;
    return;
  }

  titleEl.textContent = feature.title;
  backBtn.hidden = false;
  let section = mounted.get(id);
  if (!section) {
    section = document.createElement('section');
    section.className = 'screen';
    section.dataset.screen = id;
    app.append(section);
    mounted.set(id, section);
    const mod = await import(feature.module);
    mod.mount(section);
  }
  section.hidden = false;
  window.scrollTo(0, 0);
}

backBtn.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.hash = '';
});

renderMenu();
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
