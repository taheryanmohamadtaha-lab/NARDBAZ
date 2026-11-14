import test from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES, CATEGORIES } from '../src/practice/puzzles.js';
import { judge } from '../src/tutorial/evaluate.js';
import { createGame, setDice, playMove, getLegalMoves } from '../src/rules/game-state.js';
import { allTurnOutcomes } from '../src/rules/movement.js';
import { cloneBoard } from '../src/rules/board.js';

test('هر دسته‌بندی دست‌کم یک تمرین دارد', () => {
  for (const c of CATEGORIES) assert.ok(PUZZLES.some((p) => p.category === c.id), c.id);
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, PUZZLES.length);
});

for (const pz of PUZZLES) {
  test(`تمرین ${pz.id} — ${pz.title}`, () => {
    assert.ok(pz.explain && pz.text);
    if (pz.kind === 'choice') return assert.ok(pz.correct < pz.options.length);
    if (pz.kind === 'pick') return assert.ok(pz.correct.length > 0);
    // راه‌حل باید روی موتور واقعی پذیرفته شود
    const g = createGame({ mode: 'local' });
    g.board = cloneBoard(pz.board);
    g.turn = 0;
    g.phase = 'rolling';
    setDice(g, pz.dice[0], pz.dice[1]);
    assert.equal(g.phase, 'moving');
    let last;
    const attempt = [];
    for (const mv of pz.solve) {
      const legal = getLegalMoves(g).find((x) => x.from === mv.from && x.to === mv.to && x.die === mv.die);
      assert.ok(legal, `راه‌حل غیرقانونی ${JSON.stringify(mv)}`);
      const r = playMove(g, legal);
      attempt.push(legal);
      last = judge(pz, { chain: [legal], from: legal.from, to: legal.to, hit: !!legal.hit, board: g.board, attempt, ended: r.ended, player: 0 });
    }
    assert.equal(last.status, 'ok', JSON.stringify(last));
    // تمرین نباید بی‌معنی باشد: دست‌کم یک نتیجه‌ی قانونی دیگر باید رد شود
    const outs = allTurnOutcomes(pz.board, 0, pz.dice[0], pz.dice[1]);
    let okN = 0;
    let failN = 0;
    for (const o of outs) {
      const mv = o.moves;
      const r = judge(pz, { chain: mv, from: mv[0].from, to: mv[mv.length - 1].to, hit: mv.some((x) => x.hit), board: o.board, attempt: mv, ended: 'turn', player: 0 });
      if (r.status === 'ok') okN++;
      else failN++;
    }
    assert.ok(okN > 0, 'هیچ نتیجه‌ای پذیرفته نمی‌شود');
    assert.ok(failN > 0, 'همه‌ی نتیجه‌ها پذیرفته می‌شوند (تمرین بی‌معنی)');
  });
}
