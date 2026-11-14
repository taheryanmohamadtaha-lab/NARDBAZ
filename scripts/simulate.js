// شبیه‌سازی بازی بین سطوح مختلف هوش مصنوعی برای اطمینان از اثر واقعی سطح دشواری.
// اجرا: node scripts/simulate.js [تعداد بازی] [سطح۱] [سطح۲]
import { createGame, rollOpening, rollDice, playMove, passTurn } from '../src/rules/game-state.js';
import { chooseTurn } from '../src/ai/index.js';

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playGame(levels, seed) {
  const rng = mulberry32(seed);
  const g = createGame({ mode: 'local' });
  while (g.phase === 'opening') rollOpening(g, rng);
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 1500) {
    if (g.phase === 'rolling') rollDice(g, rng);
    if (g.phase === 'blocked') {
      passTurn(g);
      continue;
    }
    const level = levels[g.turn];
    const { moves } = chooseTurn(g.board, g.turn, g.dice[0], g.dice[1], level, rng, g.plan);
    for (const m of moves) playMove(g, m);
  }
  return g.phase === 'over' ? g.result : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 20);
  const a = process.argv[3] || 'hard';
  const b = process.argv[4] || 'easy';
  let winsA = 0;
  let pointsA = 0;
  let pointsB = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    // نیمی از بازی‌ها رنگ‌ها عوض می‌شوند تا مزیت شروع حذف شود
    const swap = i % 2 === 1;
    const levels = swap ? [b, a] : [a, b];
    const r = playGame(levels, 1000 + i);
    if (!r) continue;
    const aIsWinner = swap ? r.winner === 1 : r.winner === 0;
    if (aIsWinner) {
      winsA++;
      pointsA += r.points;
    } else pointsB += r.points;
  }
  console.log(`${a} در برابر ${b}: ${winsA} برد از ${n} بازی | امتیاز ${pointsA} - ${pointsB} | ${((Date.now() - t0) / 1000).toFixed(1)} ثانیه`);
}
