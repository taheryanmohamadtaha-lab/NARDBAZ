import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, rollOpening, rollDice, playMove, passTurn } from '../src/rules/game-state.js';
import { chooseTurn } from '../src/ai/index.js';
import { hitRolls, evaluate } from '../src/ai/eval.js';
import { playGame } from '../scripts/simulate.js';
import { boardFrom, fill } from './helpers.js';
import { WHITE, BLACK } from '../src/rules/board.js';

function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

for (const level of ['easy', 'medium', 'hard']) {
  test(`هوش مصنوعی ${level}: همیشه حرکت قانونی و کامل بازی می‌کند`, () => {
    const rng = lcg(7);
    const games = level === 'hard' ? 2 : 10;
    for (let n = 0; n < games; n++) {
      const g = createGame({ mode: 'local' });
      while (g.phase === 'opening') rollOpening(g, rng);
      let guard = 0;
      while (g.phase !== 'over' && guard++ < 1500) {
        if (g.phase === 'rolling') rollDice(g, rng);
        if (g.phase === 'blocked') {
          passTurn(g);
          continue;
        }
        const need = g.plan.requiredLen;
        const { moves } = chooseTurn(g.board, g.turn, g.dice[0], g.dice[1], level, rng, g.plan);
        assert.equal(moves.length, need, 'باید به اندازه‌ی طول لازم حرکت کند');
        for (const m of moves) playMove(g, m); // اگر غیرقانونی باشد خطا می‌دهد
      }
      assert.equal(g.phase, 'over');
    }
  });
}

test('ارزیابی: احتمال زده شدن مهره‌ی تک با فاصله‌ی ۶ از ۱۱ حالت از ۳۶ بیشتر است', () => {
  // مهره‌ی تک سفید روی اندیس ۱۰ و مهره‌ی مشکی روی اندیس ۴ ... مشکی حرکتش رو به بالاست: فاصله ۶
  const b = boardFrom({ w: { 11: 1, 24: 1 }, b: { 20: 1 } }); // مشکی اندیس ۴
  fill(b, WHITE);
  fill(b, BLACK);
  const r = hitRolls(b, WHITE, 10);
  assert.ok(r >= 11, `تعداد تاس‌های زننده ${r}`);
  // فاصله‌ی ۲۱ با هیچ تاسی قابل زدن نیست (حداکثر ممکن ۲۴ فقط با ۶-۶ است و ۲۱ مضرب ۶ نیست)
  const far = boardFrom({ w: { 22: 1, 12: 1 }, b: { 24: 1 } }); // مشکی اندیس ۰، مهره‌ی تک سفید اندیس ۲۱
  fill(far, WHITE);
  fill(far, BLACK);
  assert.equal(hitRolls(far, WHITE, 21), 0);
});

test('ارزیابی: مهره‌ی تک خطرناک‌تر از مهره‌ی محافظت‌شده است', () => {
  const safe = boardFrom({ w: { 8: 2, 12: 2 }, b: { 21: 2, 20: 1 } }); // مشکی روی اندیس ۳ و ۴
  const risky = boardFrom({ w: { 8: 1, 12: 3 }, b: { 21: 2, 20: 1 } });
  for (const b of [safe, risky]) {
    fill(b, WHITE);
    fill(b, BLACK);
  }
  assert.ok(evaluate(safe, WHITE) > evaluate(risky, WHITE));
});

test('سطح دشواری واقعاً اثر دارد: متوسط در برابر آسان بیشتر از نصف بازی‌ها را می‌برد', () => {
  let wins = 0;
  const total = 24;
  for (let i = 0; i < total; i++) {
    const swap = i % 2 === 1;
    const levels = swap ? ['easy', 'medium'] : ['medium', 'easy'];
    const r = playGame(levels, 500 + i);
    assert.ok(r);
    const mediumWon = swap ? r.winner === BLACK : r.winner === WHITE;
    if (mediumWon) wins++;
  }
  assert.ok(wins >= total * 0.6, `متوسط فقط ${wins} از ${total} بازی را برد`);
});
