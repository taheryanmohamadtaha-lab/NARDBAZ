// واسط استفاده از هوش مصنوعی: در Worker اجرا می‌شود و در صورت نبود Worker مستقیماً در همان نخ
import { chooseTurn } from './index.js';

let worker = null;
let workerFailed = false;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (workerFailed) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      clearTimeout(p.timer);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve({ moves: e.data.moves });
    };
    worker.onerror = () => {
      workerFailed = true;
      worker = null;
      for (const [, p] of pending) p.reject(new Error('worker'));
      pending.clear();
    };
    return worker;
  } catch (_) {
    workerFailed = true;
    return null;
  }
}

export function aiChoose(board, player, d1, d2, level) {
  const direct = () =>
    new Promise((resolve) => setTimeout(() => resolve(chooseTurn(board, player, d1, d2, level)), 30));
  const w = getWorker();
  if (!w) return direct();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('timeout'));
    }, 12000);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, board, player, d1, d2, level });
  }).catch(() => direct());
}
