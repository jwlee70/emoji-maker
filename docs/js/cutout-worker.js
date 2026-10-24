// 배경 제거를 화면이 멈추지 않도록 별도 작업 스레드(Worker)에서 실행한다.
// 모델과 계산 모두 폰 안에서 처리되며, 사진은 어디로도 전송되지 않는다.
import { removeBackground } from '../vendor/bgr-lib.mjs';

const publicPath = new URL('../vendor/bgr/', import.meta.url).href;

self.onmessage = async (e) => {
  const { id, blob } = e.data;
  try {
    const result = await removeBackground(blob, {
      publicPath,
      model: 'isnet_quint8',
      device: 'cpu',
      output: { format: 'image/png' },
      progress: (key, current, total) => {
        self.postMessage({ id, type: 'progress', key, current, total });
      },
    });
    self.postMessage({ id, type: 'done', blob: result });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err && err.message || err) });
  }
};
