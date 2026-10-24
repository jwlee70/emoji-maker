// 사진을 그림처럼 바꾸는 필터들 (만화 · 수채화 · 스케치).
// 외부 라이브러리나 서버 없이 폰 안에서 픽셀 계산만으로 처리한다.
// 입력/출력은 투명 배경 그림(캔버스)이고, 투명한 부분은 그대로 둔다.

export const STYLES = [
  { id: 'photo', label: '사진' },
  { id: 'cartoon', label: '만화' },
  { id: 'watercolor', label: '수채화' },
  { id: 'sketch', label: '스케치' },
];

/** @returns {OffscreenCanvas} */
export function stylize(src, style) {
  if (style === 'photo') return src;
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const input = ctx.getImageData(0, 0, w, h);
  const rgb = overWhite(input.data);
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = input.data[i * 4 + 3];
  let out;
  if (style === 'cartoon') out = cartoon(rgb, alpha, w, h);
  else if (style === 'watercolor') out = watercolor(rgb, w, h);
  else out = sketch(rgb, alpha, w, h);

  // 원래 모양(투명도)을 되돌려 붙인다
  const res = new ImageData(w, h);
  for (let i = 0, n = w * h; i < n; i++) {
    res.data[i * 4] = out[i * 3];
    res.data[i * 4 + 1] = out[i * 3 + 1];
    res.data[i * 4 + 2] = out[i * 3 + 2];
    res.data[i * 4 + 3] = input.data[i * 4 + 3];
  }
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').putImageData(res, 0, 0);
  return c;
}

// 투명한 부분을 흰색으로 채운 RGB 배열 (가장자리 계산이 깔끔해진다)
function overWhite(px) {
  const n = px.length / 4;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = px[i * 4 + k] * a + 255 * (1 - a);
  }
  return rgb;
}

function luminance(rgb, n) {
  const l = new Float32Array(n);
  for (let i = 0; i < n; i++) l[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
  return l;
}

// 상자 흐림(가로·세로 따로) — 한 채널용
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const d = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / d;
      s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / d;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// 쿠와하라 필터: 경계는 살리고 면은 붓칠처럼 평평하게 만든다.
// 각 점 주변 네 구역 중 색이 가장 고른 구역의 평균색을 쓴다.
function kuwahara(rgb, w, h, r) {
  const W = w + 1;
  const n = W * (h + 1);
  const sR = new Float64Array(n), sG = new Float64Array(n), sB = new Float64Array(n);
  const sL = new Float64Array(n), sL2 = new Float64Array(n);
  for (let y = 0; y < h; y++) {
    let aR = 0, aG = 0, aB = 0, aL = 0, aL2 = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B;
      aR += R; aG += G; aB += B; aL += L; aL2 += L * L;
      const j = (y + 1) * W + x + 1, k = y * W + x + 1;
      sR[j] = sR[k] + aR; sG[j] = sG[k] + aG; sB[j] = sB[k] + aB;
      sL[j] = sL[k] + aL; sL2[j] = sL2[k] + aL2;
    }
  }
  const box = (s, x0, y0, x1, y1) => s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0];
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity, bi = 0, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w, (q & 1 ? x + r : x) + 1);
        const y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h, (q & 2 ? y + r : y) + 1);
        const cnt = (x1 - x0) * (y1 - y0);
        const m = box(sL, x0, y0, x1, y1) / cnt;
        const v = box(sL2, x0, y0, x1, y1) / cnt - m * m;
        if (v < best) { best = v; bi = cnt; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
      }
      const o = (y * w + x) * 3;
      out[o] = box(sR, bx0, by0, bx1, by1) / bi;
      out[o + 1] = box(sG, bx0, by0, bx1, by1) / bi;
      out[o + 2] = box(sB, bx0, by0, bx1, by1) / bi;
    }
  }
  return out;
}

// 소벨 경계 세기(0~1)
function edges(lum, w, h) {
  const e = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      e[i] = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 1020);
    }
  }
  return e;
}

function saturate(r, g, b, amount) {
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return [l + (r - l) * amount, l + (g - l) * amount, l + (b - l) * amount];
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function cartoon(rgb, alpha, w, h) {
  const n = w * h;
  const r = Math.max(2, Math.round(Math.max(w, h) / 180));
  const flat = kuwahara(kuwahara(rgb, w, h, r), w, h, r);
  const lum = luminance(flat, n);
  const e = edges(boxBlur(lum, w, h, 1), w, h);
  const outer = edges(boxBlur(alpha, w, h, 1), w, h); // 바깥 윤곽
  const out = new Float32Array(n * 3);
  const step = 255 / 5;
  for (let i = 0; i < n; i++) {
    // 밝기만 몇 단계로 나누고 색감은 그대로 둔다 → 얼룩 없이 평평한 만화 색
    const L = lum[i];
    const Lq = Math.min(255, (Math.round(L / step) + 0.25) * step);
    const f = (Lq + 10) / (L + 10);
    const [R, G, B] = saturate(flat[i * 3] * f, flat[i * 3 + 1] * f, flat[i * 3 + 2] * f, 1.4);
    // 안쪽 경계와 바깥 윤곽을 진한 선으로
    const line = Math.max(Math.min(1, Math.max(0, (e[i] - 0.06) / 0.1)), Math.min(1, outer[i] * 3));
    const k = 1 - line * 0.88;
    out[i * 3] = clamp(R) * k + 40 * line * 0.88;
    out[i * 3 + 1] = clamp(G) * k + 28 * line * 0.88;
    out[i * 3 + 2] = clamp(B) * k + 36 * line * 0.88;
  }
  return out;
}

function watercolor(rgb, w, h) {
  const n = w * h;
  const r = Math.max(3, Math.round(Math.max(w, h) / 110));
  const soft = kuwahara(rgb, w, h, r);
  // 물감 번짐: 채널별로 살짝 흐리게
  const ch = [0, 1, 2].map((k) => {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = soft[i * 3 + k];
    return boxBlur(c, w, h, 1);
  });
  const e = edges(boxBlur(luminance(soft, n), w, h, 1), w, h);
  const out = new Float32Array(n * 3);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grain = boxBlur(Float32Array.from({ length: n }, () => rand()), w, h, 1);
  for (let i = 0; i < n; i++) {
    let [R, G, B] = saturate(ch[0][i], ch[1][i], ch[2][i], 1.25);
    // 밝고 맑게 + 종이 결
    const g = (grain[i] - 0.5) * 22;
    R = R * 0.82 + 255 * 0.18 + g;
    G = G * 0.82 + 255 * 0.18 + g;
    B = B * 0.82 + 255 * 0.18 + g;
    // 물감이 고인 듯한 옅은 테두리
    const edge = Math.min(1, e[i] * 4) * 0.35;
    out[i * 3] = clamp(R * (1 - edge) + R * 0.55 * edge);
    out[i * 3 + 1] = clamp(G * (1 - edge) + G * 0.55 * edge);
    out[i * 3 + 2] = clamp(B * (1 - edge) + B * 0.55 * edge);
  }
  return out;
}

function sketch(rgb, alpha, w, h) {
  const n = w * h;
  const gray = luminance(rgb, n);
  const inv = new Float32Array(n);
  for (let i = 0; i < n; i++) inv[i] = 255 - gray[i];
  const r = Math.max(3, Math.round(Math.max(w, h) / 90));
  const blur = boxBlur(boxBlur(inv, w, h, r), w, h, r);
  const outer = edges(boxBlur(alpha, w, h, 1), w, h);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // 연필 스케치(색 닷지): 밝은 면은 하얗게, 경계만 연필선처럼 남는다
    let v = Math.min(255, (gray[i] * 255) / Math.max(1, 255 - blur[i]));
    v = 255 * Math.pow(clamp(v) / 255, 4); // 연필선을 진하게
    v = Math.min(v, 255 - Math.min(1, outer[i] * 3) * 170); // 바깥 윤곽선
    out[i * 3] = v * 0.98;
    out[i * 3 + 1] = v * 0.97;
    out[i * 3 + 2] = v;
  }
  return out;
}
