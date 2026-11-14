// مدیریت لمس و کشیدن مهره‌ها (انتخاب مهره ← لمس مقصد، یا Drag & Drop).
// این کلاس فقط با «حالت بازی» (rules/game-state) و BoardView کار دارد و قانون جدیدی نمی‌سازد.
import { getDestinations, getLegalMoves } from '../rules/game-state.js';
import { explainIllegal } from '../rules/validation.js';
import { countAt, opponent } from '../rules/board.js';
import { applyMove } from '../rules/movement.js';
import { evaluate } from '../ai/eval.js';

/**
 * api = {
 *   ctx(): { g, enabled, hints },
 *   refresh(): void,            // دوباره‌کشیدن صفحه
 *   playChain(chain): void,     // اجرای زنجیره‌ی حرکت‌ها
 *   message(text, kind): void,
 *   sfx: { click, error }
 * }
 */
export class MoveInput {
  constructor(view, api) {
    this.view = view;
    this.api = api;
    this.selected = null;
    this.dests = new Map();
    this.drag = null;
    this.press = null;
    this.sources = [];
    this.hint = null;
    view.handlers = {
      onDown: (e) => this.down(e),
      onMove: (e) => this.move(e),
      onUp: (e) => this.up(e),
    };
  }

  reset() {
    this.selected = null;
    this.dests = new Map();
    this.drag = null;
    this.press = null;
    this.sources = [];
    this.hint = null;
    this.view.hideGhost();
  }

  /** گزینه‌های بصری برای BoardView.render */
  visual() {
    const { g, hints } = this.api.ctx();
    return {
      player: g.turn ?? 0,
      selected: this.selected,
      targets: hints ? Array.from(this.dests.keys()) : [],
      sources: this.sources,
      hint: this.hint,
      dragLoc: this.drag?.started ? this.drag.loc : null,
      dragPlayer: g.turn ?? 0,
    };
  }

  isOwnSource(g, loc) {
    const p = g.turn;
    if (loc === 'bar') return g.board.bar[p] > 0;
    return typeof loc === 'number' && countAt(g.board, p, loc) > 0;
  }

  select(loc) {
    const { g } = this.api.ctx();
    this.sources = [];
    this.hint = null;
    const dests = getDestinations(g, loc);
    if (dests.size === 0) {
      this.selected = null;
      this.dests = new Map();
      const p = g.turn;
      const msg =
        g.board.bar[p] > 0 && loc !== 'bar'
          ? 'ابتدا باید مهره‌ی زده‌شده را از Bar وارد بازی کنید.'
          : 'این مهره با تاس‌های فعلی حرکت مجازی ندارد.';
      this.api.message(msg, 'warn');
      this.api.sfx.error();
      return false;
    }
    this.selected = loc;
    this.dests = dests;
    this.api.sfx.click();
    return true;
  }

  down(e) {
    const { g, enabled } = this.api.ctx();
    if (!enabled || e.loc === undefined) return;
    this.press = { loc: e.loc, start: e.pos, wasSelected: this.selected === e.loc };
    if (this.selected !== null && this.dests.has(e.loc)) return; // لمس مقصد
    if (e.loc === 'off') return;
    if (this.isOwnSource(g, e.loc)) {
      const ok = this.select(e.loc);
      if (ok) this.drag = { loc: e.loc, started: false };
      this.api.refresh();
    }
  }

  move(e) {
    if (!this.drag) return;
    const { g } = this.api.ctx();
    if (!this.drag.started) {
      const dx = e.pos.x - this.press.start.x;
      const dy = e.pos.y - this.press.start.y;
      if (dx * dx + dy * dy < 18 * 18) return;
      this.drag.started = true;
      this.view.showGhost(e.pos, g.turn);
      this.api.refresh();
    } else {
      this.view.moveGhost(e.pos);
    }
  }

  up(e) {
    const { g, enabled } = this.api.ctx();
    const wasDrag = this.drag?.started;
    this.view.hideGhost();
    const drag = this.drag;
    this.drag = null;
    if (!enabled) return;
    const press = this.press;
    this.press = null;

    // مقصد را از loc رهاسازی می‌گیریم
    const target = e.loc;
    if (wasDrag) {
      if (target !== undefined && this.dests.has(target)) return this.commit(target);
      if (target !== undefined && target !== drag.loc) this.explain(g, drag.loc, target);
      this.api.refresh();
      return;
    }
    if (!press || e.cancelled) return;
    if (this.selected !== null) {
      if (target !== undefined && this.dests.has(target)) return this.commit(target);
      if (target === this.selected && press.wasSelected) {
        this.selected = null;
        this.dests = new Map();
        this.api.refresh();
        return;
      }
      if (target !== undefined && target !== this.selected && !this.isOwnSource(g, target)) {
        this.explain(g, this.selected, target);
      }
    }
    this.api.refresh();
  }

  explain(g, from, to) {
    const msg = explainIllegal(g.board, g.turn, g.remaining, g.plan, g.played, from, to);
    this.api.message(msg, 'warn');
    this.api.sfx.error();
  }

  commit(to) {
    const chain = this.dests.get(to);
    this.selected = null;
    this.dests = new Map();
    this.sources = [];
    this.hint = null;
    this.api.playChain(chain);
  }

  /** راهنما: مهره‌های قابل حرکت را برجسته و بهترین حرکت بعدی را پیشنهاد می‌دهد */
  showHint() {
    const { g } = this.api.ctx();
    const legal = getLegalMoves(g);
    if (legal.length === 0) {
      this.api.message('حرکت مجازی وجود ندارد.', 'info');
      return;
    }
    const p = g.turn;
    this.sources = Array.from(new Set(legal.map((m) => m.from)));
    let best = null;
    let bestScore = -Infinity;
    for (const m of legal) {
      const s = evaluate(applyMove(g.board, p, m), p);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    this.hint = best ? { from: best.from, to: best.to } : null;
    this.selected = null;
    this.dests = new Map();
    this.api.message('مهره‌های زردرنگ قابل حرکت‌اند؛ پیکان طلایی حرکت پیشنهادی است.', 'info');
    this.api.refresh();
  }
}

export { opponent };
