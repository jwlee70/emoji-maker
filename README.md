# 나만의 스티커 (emoji-maker)

사진을 골라 배경을 지우고, 테두리·글자를 넣어 카톡·인스타·문자로 보내는 휴대폰용 웹앱(PWA)입니다.
회원가입 없음, 사진은 폰 밖으로 나가지 않음(배경 제거 AI가 폰 안에서 동작).

## 지금 되는 것 (1단계)
- 📸 사진으로 스티커: 사진 찍기/갤러리 → 배경 자동 제거 → 테두리(두께·색) → 글자(선택) → 보내기/저장
- 홈 화면에 추가 가능, 한 번 쓰고 나면 인터넷 없이도 동작

## 다음 단계 (아직 안 함)
글자 이모티콘 · 움직이는 스티커(GIF) · 캐릭터 꾸미기
→ `docs/js/app.js` 의 `FEATURES` 에 모듈 경로를 넣고 `docs/js/features/` 에 `mount(section)` 을 내보내는 파일을 추가하면 홈 메뉴에 붙습니다.

## 폴더 구조
```
docs/                     ← GitHub Pages 로 그대로 올라가는 웹사이트
  index.html, style.css, manifest.webmanifest, sw.js
  js/app.js               ← 홈 메뉴·화면 전환
  js/features/photo-sticker.js  ← 1단계 화면
  js/sticker-render.js    ← 테두리·그림자·글자 그리기
  js/cutout-worker.js     ← 배경 제거(별도 스레드)
  js/share.js             ← 공유/저장
  vendor/bgr-lib.mjs      ← 배경 제거 라이브러리(빌드 결과)
  vendor/bgr/             ← AI 모델(isnet_quint8)·onnxruntime wasm (약 54MB)
scripts/                  ← 라이브러리 빌드·모델 받기·아이콘 생성 스크립트
```

## 내 컴퓨터에서 실행
```bash
npm run serve
```
그다음 브라우저에서 http://localhost:8765 을 엽니다.

라이브러리/모델을 다시 받아야 할 때: `npm install` → `npm run build:lib` → `npm run fetch:model`

## GitHub Pages 배포
1. GitHub 에 `emoji-maker` 저장소(공개)를 만들고 이 폴더를 올립니다.
2. 저장소 Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / 폴더 `/docs` → Save.
3. 1~2분 뒤 `https://jwlee70.github.io/emoji-maker/` 에서 열립니다.

## 라이선스
배경 제거에 쓰는 [IMG.LY background-removal-js](https://github.com/imgly/background-removal-js) 가 AGPL-3.0 이라,
이 앱 전체도 AGPL-3.0 으로 공개합니다(`LICENSE.md`). 공개 저장소에 소스를 그대로 두면 조건을 지키는 것입니다.
아이콘은 `scripts/make-icons.py` 로 직접 그렸고, 다른 서비스의 코드나 그림은 쓰지 않았습니다.
