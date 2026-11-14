// اجرای هوش مصنوعی در Web Worker تا رابط کاربری هنگام محاسبه قفل نشود
import { chooseTurn } from './index.js';

self.onmessage = (e) => {
  const { id, board, player, d1, d2, level } = e.data;
  try {
    const r = chooseTurn(board, player, d1, d2, level);
    self.postMessage({ id, moves: r.moves });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
