// 배경이 지워진 그림(투명 PNG)에 테두리·그림자·글자를 입혀 정사각형 스티커로 그린다.

export const SIZE = 800; // 내보내는 스티커 크기(px)

// 배경 제거 뒤 남은 흐릿한 얼룩과 작은 조각을 지운다.
// (그대로 두면 테두리가 얼룩마다 붙어 지저분해진다)
export function cleanCutout(bitmap) {
  const w = bitmap.width, h = bitmap.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const n = w * h;

  // 1) 거의 투명한 부분은 완전히 투명하게
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 64) px[i * 4 + 3] = 0;

  // 2) 붙어 있는 덩어리별로 크기를 재서, 가장 큰 덩어리보다 훨씬 작은 조각은 지운다
  const label = new Int32Array(n);
  const sizes = [0];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (label[start] || px[start * 4 + 3] === 0) continue;
    const id = sizes.length;
    let top = 0, size = 0;
    stack[top++] = start;
    label[start] = id;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % w;
      for (let k = 0; k < 4; k++) {
        const q = k === 0 ? (x > 0 ? p - 1 : -1) : k === 1 ? (x < w - 1 ? p + 1 : -1) : k === 2 ? p - w : p + w;
        if (q >= 0 && q < n && !label[q] && px[q * 4 + 3] !== 0) {
          label[q] = id;
          stack[top++] = q;
        }
      }
    }
    sizes.push(size);
  }
  const keepMin = Math.max(...sizes) * 0.03;
  for (let i = 0; i < n; i++) if (label[i] && sizes[label[i]] < keepMin) px[i * 4 + 3] = 0;

  ctx.putImageData(img, 0, 0);
  return c;
}

// 투명하지 않은 부분만 남기도록 잘라낼 범위를 찾는다.
function findBounds(bitmap) {
  const scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // 남은 게 없음
  return {
    x: minX / scale, y: minY / scale,
    w: (maxX - minX + 1) / scale, h: (maxY - minY + 1) / scale,
  };
}

// 모양 그대로 한 가지 색으로 칠한 실루엣을 만든다.
function silhouette(src, color) {
  const c = new OffscreenCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// 실루엣을 사방으로 조금씩 밀어 겹쳐 그려서 두꺼운 외곽선을 만든다.
function outlined(src, width, color) {
  const pad = Math.ceil(width) + 2;
  const c = new OffscreenCanvas(src.width + pad * 2, src.height + pad * 2);
  const ctx = c.getContext('2d');
  if (width > 0) {
    const sil = silhouette(src, color);
    for (const r of [width, width * 0.66, width * 0.33]) {
      const steps = Math.max(16, Math.ceil(r * 2.2));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        ctx.drawImage(sil, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
    }
  }
  ctx.drawImage(src, pad, pad);
  return c;
}

/**
 * @param {OffscreenCanvas} cutout 배경이 지워지고 cleanCutout 으로 정리된 그림
 * @param {{outline:number, outlineColor:string, text:string, textColor:string}} opts
 *   outline: 테두리 두께(스티커 크기 대비 비율, 0이면 없음)
 * @returns {OffscreenCanvas}
 */
export function renderSticker(cutout, opts) {
  const out = new OffscreenCanvas(SIZE, SIZE);
  const ctx = out.getContext('2d');
  const b = findBounds(cutout);
  if (!b) return out;

  const border = Math.round(SIZE * opts.outline);
  const margin = Math.round(SIZE * 0.04) + border;
  const text = (opts.text || '').trim();
  const fontPx = text ? Math.round(Math.min(SIZE * 0.16, (SIZE * 0.9) / Math.max(1, [...text].length))) : 0;
  const textArea = text ? Math.round(fontPx * 0.75) : 0;

  // 그림이 들어갈 칸에 맞게 크기 조정 (글자가 있으면 아래쪽을 조금 비운다)
  const boxW = SIZE - margin * 2;
  const boxH = SIZE - margin * 2 - textArea;
  const scale = Math.min(boxW / b.w, boxH / b.h);
  const w = Math.max(1, Math.round(b.w * scale));
  const h = Math.max(1, Math.round(b.h * scale));
  const subject = new OffscreenCanvas(w, h);
  const sctx = subject.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(cutout, b.x, b.y, b.w, b.h, 0, 0, w, h);

  const sticker = outlined(subject, border, opts.outlineColor);
  const pad = (sticker.width - w) / 2;
  const x = Math.round((SIZE - w) / 2 - pad);
  const y = Math.round(margin + (boxH - h) / 2 - pad);

  // 살짝 그림자를 주어 '붙인 스티커' 느낌을 낸다
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = SIZE * 0.02;
  ctx.shadowOffsetY = SIZE * 0.008;
  ctx.drawImage(sticker, x, y);
  ctx.restore();

  if (text) {
    ctx.font = `900 ${fontPx}px system-ui, "Samsung Sans", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const tx = SIZE / 2;
    const ty = SIZE - Math.round(SIZE * 0.05);
    const maxW = SIZE * 0.94;
    ctx.lineWidth = Math.max(8, fontPx * 0.22);
    ctx.strokeStyle = opts.textColor === '#ffffff' ? '#2b2230' : '#ffffff';
    ctx.strokeText(text, tx, ty, maxW);
    ctx.fillStyle = opts.textColor;
    ctx.fillText(text, tx, ty, maxW);
  }
  return out;
}
