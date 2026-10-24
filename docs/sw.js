// 오프라인 지원용 서비스 워커.
// - 앱 화면 파일: 인터넷이 되면 새로 받고(업데이트 반영), 안 되면 보관본을 쓴다.
// - AI 모델 파일(vendor/bgr): 바뀌지 않는 파일이라 한 번 받으면 보관본만 쓴다.
const SHELL = 'shell-v2';
const MODEL = 'model-v1';
const SHELL_FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/share.js', 'js/sticker-render.js', 'js/stylize.js', 'js/cutout-worker.js',
  'js/features/photo-sticker.js', 'vendor/bgr-lib.mjs',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MODEL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/vendor/bgr/')) {
    e.respondWith(
      caches.open(MODEL).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
