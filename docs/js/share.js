// 완성된 스티커를 다른 앱(카톡·인스타·문자)으로 보내거나 폰에 저장한다.

export function fileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `sticker_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

// 폰의 '공유하기' 창을 띄운다. 공유가 안 되는 브라우저면 저장으로 대신한다.
// 반환값: 'shared' | 'saved' | 'cancelled'
export async function shareOrSave(blob) {
  const file = new File([blob], fileName(), { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // 그 밖의 오류면 저장으로 넘어간다
    }
  }
  save(blob);
  return 'saved';
}

export function save(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
