import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_LESSONS } from '../src/tutorial/lessons.js';
import { judge } from '../src/tutorial/evaluate.js';
import { createGame, setDice, playMove, getLegalMoves } from '../src/rules/game-state.js';
import { singleMoves, applyMove } from '../src/rules/movement.js';
import { cloneBoard } from '../src/rules/board.js';

function runSteps(steps, fn) {
  let cur = null;
  for (const s of steps) {
    if (s.board) cur = cloneBoard(s.board);
    fn(s, cur, (b) => (cur = b));
  }
}

for (const lesson of ALL_LESSONS) {
  test(`درس ${lesson.id} — ${lesson.title}`, () => {
    assert.ok(lesson.steps.length > 0);
    assert.ok(lesson.steps[0].board, 'مرحله‌ی اول باید صفحه داشته باشد');
    runSteps(lesson.steps, (s, cur, setCur) => {
      assert.ok(['info', 'demo', 'task', 'pick', 'choice'].includes(s.kind));
      assert.ok(s.text && s.text.length > 5, 'متن آموزشی لازم است');
      if (s.kind === 'demo') {
        let b = cur;
        const p = s.player ?? 0;
        for (const mv of s.moves) {
          const legal = singleMoves(b, p, mv.die).find((x) => x.from === mv.from && x.to === mv.to);
          assert.ok(legal, `حرکت نمایشی غیرقانونی: ${JSON.stringify(mv)} در ${lesson.id}`);
          assert.equal(!!legal.hit, !!mv.hit, `پرچم hit نادرست: ${JSON.stringify(mv)}`);
          b = applyMove(b, p, mv);
        }
        setCur(b);
      }
      if (s.kind === 'pick') {
        const n = typeof s.correct === 'function' ? ALL(24).filter(s.correct).length : s.correct.length;
        assert.ok(n > 0);
      }
      if (s.kind === 'choice') {
        assert.ok(s.correct >= 0 && s.correct < s.options.length);
      }
      if (s.kind === 'task') {
        const g = createGame({ mode: 'local' });
        g.board = cloneBoard(cur);
        g.turn = s.player ?? 0;
        g.phase = 'rolling';
        setDice(g, s.dice[0], s.dice[1]);
        assert.equal(g.phase, 'moving', 'در مرحله‌ی تمرین باید حرکت قانونی وجود داشته باشد');
        assert.ok(s.solve && s.solve.length > 0, 'راه‌حل لازم است');
        const attempt = [];
        const chains = s.expect ? [s.solve] : s.solve.map((x) => [x]);
        let last = null;
        for (const chain of chains) {
          let ended = null;
          for (const mv of chain) {
            assert.ok(
              getLegalMoves(g).some((x) => x.from === mv.from && x.to === mv.to && x.die === mv.die),
              `حرکت راه‌حل قانونی نیست: ${JSON.stringify(mv)} در ${lesson.id}`,
            );
            const legal = getLegalMoves(g).find((x) => x.from === mv.from && x.to === mv.to && x.die === mv.die);
            const r = playMove(g, legal);
            attempt.push(legal);
            if (r.ended) ended = r.ended;
          }
          const info = {
            chain,
            from: chain[0].from,
            to: chain[chain.length - 1].to,
            hit: chain.some((x) => x.hit),
            board: g.board,
            attempt,
            ended,
            player: s.player ?? 0,
          };
          last = judge(s, info);
        }
        assert.equal(last.status, 'ok', `راه‌حل باید پذیرفته شود (${lesson.id}): ${JSON.stringify(last)}`);
      }
    });
  });
}
const ALL = (n) => Array.from({ length: n }, (_, i) => i);
