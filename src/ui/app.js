// پوسته‌ی برنامه: مسیریابی بین صفحه‌ها (منو، بازی، آموزش، تمرین، تنظیمات، درباره)
import { h, clear, modal, confirmDialog } from './dom.js';
import { faNum } from '../game/board-view.js';
import { GameController } from '../game/controller.js';
import { ScenarioRunner } from '../tutorial/runner.js';
import { CHAPTERS, ALL_LESSONS } from '../tutorial/lessons.js';
import { PUZZLES, CATEGORIES } from '../practice/puzzles.js';
import { configureSound, sfx } from '../audio/sound.js';
import * as store from '../storage/store.js';

const LEVEL_FA = { easy: 'آسان', medium: 'متوسط', hard: 'سخت' };
const VERSION = '1.0.0';

export class App {
  constructor(root) {
    this.root = root;
    this.current = null;
    this._settings = store.getSettings();
    this.applySettings();
    window.addEventListener('popstate', (e) => this.render(e.state || { name: 'menu' }));
    history.replaceState({ name: 'menu' }, '');
    this.render({ name: 'menu' });
  }

  // ---------- تنظیمات ----------
  settings() {
    return this._settings;
  }
  updateSettings(patch) {
    this._settings = { ...this._settings, ...patch };
    store.setSettings(this._settings);
    this.applySettings();
  }
  reloadSettings() {
    this._settings = store.getSettings();
    this.applySettings();
  }
  applySettings() {
    document.documentElement.dataset.theme = this._settings.theme;
    configureSound(this._settings);
  }

  // ---------- مسیریابی ----------
  go(state, { replace = false } = {}) {
    if (replace) history.replaceState(state, '');
    else history.pushState(state, '');
    this.render(state);
  }
  showMenu() {
    // به ریشه برمی‌گردیم: همه‌ی صفحه‌های پشته را کنار می‌گذاریم
    this.go({ name: 'menu' }, { replace: true });
  }
  startGame(mode, difficulty) {
    store.clearSavedGame();
    this.go({ name: 'game', mode, difficulty, resume: false });
  }
  resumeGame() {
    this.go({ name: 'game', resume: true });
  }
  back() {
    history.back();
  }

  destroyCurrent() {
    this.current?.destroy?.();
    this.current = null;
  }

  render(state) {
    this.destroyCurrent();
    document.querySelectorAll('.modal-back').forEach((n) => n.remove());
    clear(this.root);
    const c = h('div', { class: 'screen' });
    this.root.appendChild(c);
    switch (state.name) {
      case 'game': {
        const saved = state.resume ? store.getSavedGame() : null;
        if (state.resume && !saved) return this.showMenu();
        this.current = new GameController({ container: c, app: this, mode: state.mode, difficulty: state.difficulty, resume: saved });
        break;
      }
      case 'tutorial':
        this.tutorialList(c);
        break;
      case 'lesson':
        this.lesson(c, state.id);
        break;
      case 'practice':
        this.practiceList(c);
        break;
      case 'puzzle':
        this.puzzle(c, state.id);
        break;
      case 'settings':
        this.settingsScreen(c);
        break;
      case 'about':
        this.about(c);
        break;
      default:
        this.menu(c);
    }
  }

  header(title, onBack) {
    return h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'بازگشت', onClick: () => (onBack ? onBack() : this.back()) }, '→'),
      h('div', { class: 'title-center' }, title),
      h('span', { class: 'icon-btn ghost' }),
    );
  }

  // ---------- منوی اصلی ----------
  menu(c) {
    c.classList.add('menu');
    const saved = store.getSavedGame();
    const item = (ico, label, fn, kind = '') => h('button', { class: `btn ${kind}`, onClick: () => { sfx.click(); fn(); } }, h('span', { class: 'ico' }, ico), label);
    const logo = h('div', { class: 'logo', html: LOGO_SVG }, null);
    logo.append(h('h1', {}, 'نردباز'), h('small', {}, 'NARDBAZ'));
    const list = h('div', { class: 'menu-list' });
    if (saved) list.appendChild(item('▶️', 'ادامه‌ی بازی قبلی', () => this.resumeGame(), 'primary'));
    list.append(
      item('🎮', 'شروع بازی', () => this.startDialog(), saved ? '' : 'primary'),
      item('🤖', 'بازی با هوش مصنوعی', () => this.levelDialog()),
      item('👥', 'بازی دونفره', () => this.startGame('local', 'medium')),
      item('🎓', 'آموزش تخته‌نرد', () => this.go({ name: 'tutorial' })),
      item('🧩', 'تمرین و یادگیری قوانین', () => this.go({ name: 'practice' })),
      item('⚙️', 'تنظیمات', () => this.go({ name: 'settings' })),
      item('ℹ️', 'درباره‌ی بازی', () => this.go({ name: 'about' })),
      item('🏆', 'آمار و رکوردها', () => this.statsDialog()),
    );
    c.append(logo, list);
  }

  startDialog() {
    const d = this.settings().difficulty;
    modal({
      title: 'شروع بازی',
      body: h('p', { class: 'muted', style: { textAlign: 'center' } }, 'حریف خود را انتخاب کنید'),
      buttons: [
        { label: `🤖 هوش مصنوعی (${LEVEL_FA[d]})`, kind: 'primary', onClick: () => this.startGame('ai', d) },
        { label: '👥 بازی دونفره (روی همین دستگاه)', onClick: () => this.startGame('local', d) },
        { label: 'انصراف' },
      ],
    });
  }

  levelDialog() {
    modal({
      title: 'سطح هوش مصنوعی',
      body: h('p', { class: 'muted', style: { textAlign: 'center' } }, 'سطح سخت بهترین حرکت را با محاسبه‌ی چند نوبت بعد انتخاب می‌کند.'),
      buttons: [
        { label: 'آسان — مناسب تازه‌کارها', onClick: () => this.pickLevel('easy') },
        { label: 'متوسط — خانه‌سازی و مراقبت از مهره‌ی تنها', onClick: () => this.pickLevel('medium') },
        { label: 'سخت — محاسبه‌ی عمیق (Expectiminimax)', kind: 'primary', onClick: () => this.pickLevel('hard') },
        { label: 'انصراف' },
      ],
    });
  }
  pickLevel(level) {
    this.updateSettings({ difficulty: level });
    this.startGame('ai', level);
  }

  statsDialog() {
    const s = store.getStats();
    const body = h('div', {});
    const row = (a, b) => body.appendChild(h('div', { class: 'stat-row' }, h('span', {}, a), h('b', {}, b)));
    for (const lv of ['easy', 'medium', 'hard']) {
      const r = s.ai[lv];
      row(`هوش مصنوعی ${LEVEL_FA[lv]}`, `${faNum(r.w)} برد / ${faNum(r.l)} باخت`);
    }
    row('مجموع امتیاز بردها', faNum(s.points));
    row('گامون / بک‌گامون', `${faNum(s.gammons)} / ${faNum(s.backgammons)}`);
    row('بهترین رکورد برد پیاپی', faNum(s.bestStreak));
    row('سریع‌ترین برد (تعداد حرکت)', s.fastestWinMoves === null ? '—' : faNum(s.fastestWinMoves));
    row('بازی‌های دونفره', faNum(s.local.games));
    modal({ title: 'آمار و رکوردها', body, buttons: [{ label: 'بستن', kind: 'primary' }] });
  }

  // ---------- آموزش ----------
  tutorialList(c) {
    const prog = store.getProgress();
    const done = ALL_LESSONS.filter((l) => prog.lessons[l.id]).length;
    const list = h('div', { class: 'list page' });
    list.appendChild(h('div', { class: 'card' }, h('b', {}, `پیشرفت آموزش: ${faNum(done)} از ${faNum(ALL_LESSONS.length)} درس`), h('div', { class: 'progress', style: { marginTop: '8px' } }, h('i', { style: { width: `${(done / ALL_LESSONS.length) * 100}%` } }))));
    let n = 0;
    for (const ch of CHAPTERS) {
      list.appendChild(h('div', { class: 'section-title' }, ch.title));
      for (const l of ch.lessons) {
        n++;
        list.appendChild(
          h('button', { class: 'item', onClick: () => { sfx.click(); this.go({ name: 'lesson', id: l.id }); } },
            h('span', { class: 'num' }, faNum(n)),
            h('span', {}, l.title, h('small', {}, l.summary)),
            prog.lessons[l.id] ? h('span', { class: 'tick' }, '✓') : null,
          ),
        );
      }
    }
    c.append(this.header('آموزش تخته‌نرد', () => this.showMenu()), h('div', { class: 'scroll', style: { flex: 1 } }, list));
  }

  lesson(c, id) {
    const lesson = ALL_LESSONS.find((l) => l.id === id);
    if (!lesson) return this.showMenu();
    this.current = new ScenarioRunner({
      container: c,
      app: this,
      title: lesson.title,
      steps: lesson.steps,
      numbers: true,
      onExit: () => this.back(),
      onComplete: () => {
        const prog = store.getProgress();
        prog.lessons[id] = true;
        store.setProgress(prog);
        sfx.win();
        const idx = ALL_LESSONS.findIndex((l) => l.id === id);
        const nxt = ALL_LESSONS[idx + 1];
        modal({
          title: '🎉 درس کامل شد',
          body: lesson.title,
          dismissible: false,
          buttons: [
            nxt ? { label: `درس بعدی: ${nxt.title}`, kind: 'primary', onClick: () => this.go({ name: 'lesson', id: nxt.id }, { replace: true }) } : { label: 'آموزش تمام شد! بازگشت', kind: 'primary', onClick: () => this.go({ name: 'tutorial' }, { replace: true }) },
            { label: 'تکرار درس', onClick: () => this.go({ name: 'lesson', id }, { replace: true }) },
            { label: 'فهرست درس‌ها', onClick: () => this.go({ name: 'tutorial' }, { replace: true }) },
          ],
        });
      },
    });
  }

  // ---------- تمرین ----------
  practiceList(c) {
    const prog = store.getProgress();
    const solved = PUZZLES.filter((p) => prog.practice[p.id]?.solved).length;
    const list = h('div', { class: 'list page' });
    list.appendChild(h('div', { class: 'card' }, h('b', {}, `تمرین‌های حل‌شده: ${faNum(solved)} از ${faNum(PUZZLES.length)}`), h('div', { class: 'progress', style: { marginTop: '8px' } }, h('i', { style: { width: `${(solved / PUZZLES.length) * 100}%` } }))));
    for (const cat of CATEGORIES) {
      list.appendChild(h('div', { class: 'section-title' }, `${cat.icon} ${cat.title}`));
      for (const p of PUZZLES.filter((x) => x.category === cat.id)) {
        const st = prog.practice[p.id];
        list.appendChild(
          h('button', { class: 'item', onClick: () => { sfx.click(); this.go({ name: 'puzzle', id: p.id }); } },
            h('span', {}, p.title, h('small', {}, st?.solved ? (st.firstTry ? 'حل‌شده در تلاش اول' : 'حل‌شده') : 'حل‌نشده')),
            st?.solved ? h('span', { class: 'tick' }, '✓') : null,
          ),
        );
      }
    }
    c.append(this.header('تمرین و چالش', () => this.showMenu()), h('div', { class: 'scroll', style: { flex: 1 } }, list));
  }

  puzzle(c, id) {
    const pz = PUZZLES.find((p) => p.id === id);
    if (!pz) return this.showMenu();
    this.current = new ScenarioRunner({
      container: c,
      app: this,
      title: pz.title,
      steps: [pz],
      practice: true,
      numbers: true,
      onExit: () => this.back(),
      onComplete: ({ failedOnce }) => {
        const prog = store.getProgress();
        const old = prog.practice[id];
        prog.practice[id] = { solved: true, firstTry: old?.firstTry || !failedOnce };
        store.setProgress(prog);
        const idx = PUZZLES.findIndex((p) => p.id === id);
        const nxt = PUZZLES[idx + 1];
        modal({
          title: failedOnce ? 'حل شد' : '🎉 در تلاش اول!',
          body: pz.explain,
          dismissible: false,
          buttons: [
            nxt ? { label: 'تمرین بعدی', kind: 'primary', onClick: () => this.go({ name: 'puzzle', id: nxt.id }, { replace: true }) } : { label: 'همه‌ی تمرین‌ها تمام شد', kind: 'primary', onClick: () => this.go({ name: 'practice' }, { replace: true }) },
            { label: 'فهرست تمرین‌ها', onClick: () => this.go({ name: 'practice' }, { replace: true }) },
          ],
        });
      },
    });
  }

  // ---------- تنظیمات ----------
  settingsScreen(c) {
    const s = this.settings();
    const toggle = (key, label) => {
      const inp = h('input', { type: 'checkbox' });
      inp.checked = !!this.settings()[key];
      inp.addEventListener('change', () => { this.updateSettings({ [key]: inp.checked }); sfx.click(); });
      return h('div', { class: 'row' }, h('label', {}, label), h('span', { class: 'switch' }, inp, h('span')));
    };
    const seg = (key, label, opts) => {
      const box = h('div', { class: 'seg' });
      const paint = () => [...box.children].forEach((b) => b.classList.toggle('on', b.dataset.v === String(this.settings()[key])));
      for (const [v, t] of opts) box.appendChild(h('button', { 'data-v': v, onClick: () => { this.updateSettings({ [key]: v }); paint(); sfx.click(); } }, t));
      paint();
      return h('div', { class: 'row' }, h('label', {}, label), box);
    };
    const vol = h('input', { type: 'range', min: 0, max: 100, step: 5 });
    vol.value = Math.round(s.volume * 100);
    vol.addEventListener('input', () => this.updateSettings({ volume: vol.value / 100 }));
    vol.addEventListener('change', () => sfx.move());

    const sound = h('div', { class: 'card' },
      toggle('sound', 'صدا'),
      h('div', { class: 'row' }, h('label', {}, 'شدت صدا'), vol),
    );
    const play = h('div', { class: 'card' },
      seg('difficulty', 'سطح دشواری هوش مصنوعی', [['easy', 'آسان'], ['medium', 'متوسط'], ['hard', 'سخت']]),
      toggle('hints', 'نمایش خانه‌های مجاز'),
      seg('animSpeed', 'سرعت انیمیشن', [['slow', 'آهسته'], ['normal', 'عادی'], ['fast', 'تند']]),
      toggle('tutorialMessages', 'نمایش پیام‌های آموزشی'),
    );
    const look = h('div', { class: 'card' }, seg('theme', 'تم برنامه', [['dark', 'تیره'], ['light', 'روشن']]));
    const data = h('div', { class: 'card' },
      h('div', { class: 'modal-buttons', style: { marginTop: 0 } },
        h('button', { class: 'btn', onClick: () => this.backupDialog() }, '💾 پشتیبان‌گیری از اطلاعات'),
        h('button', { class: 'btn', onClick: () => this.restoreDialog() }, '📥 بازیابی از پشتیبان'),
        h('button', { class: 'btn danger', onClick: async () => {
          if (await confirmDialog('همه‌ی اطلاعات ذخیره‌شده (بازی نیمه‌تمام، آمار، پیشرفت آموزش و تنظیمات) پاک شود؟ این کار قابل بازگشت نیست.', 'پاک کردن')) {
            store.clearAll();
            this.reloadSettings();
            this.showMenu();
          }
        } }, '🗑 پاک کردن اطلاعات ذخیره‌شده'),
      ),
    );
    c.append(
      this.header('تنظیمات'),
      h('div', { class: 'scroll', style: { flex: 1 } }, h('div', { class: 'list page' },
        h('div', { class: 'section-title' }, 'صدا'), sound,
        h('div', { class: 'section-title' }, 'بازی'), play,
        h('div', { class: 'section-title' }, 'ظاهر'), look,
        h('div', { class: 'section-title' }, 'اطلاعات'), data,
      )),
    );
  }

  backupDialog() {
    const text = store.exportBackup();
    const ta = h('textarea', { readonly: true });
    ta.value = text;
    modal({
      title: 'پشتیبان‌گیری',
      body: h('div', {}, h('p', { class: 'muted' }, 'متن زیر را کپی کنید یا فایل پشتیبان را ذخیره کنید. بعداً از «بازیابی» می‌توانید آن را برگردانید.'), ta),
      buttons: [
        {
          label: '📋 کپی متن', keepOpen: true,
          onClick: async () => {
            try { await navigator.clipboard.writeText(text); } catch (_) { ta.select(); document.execCommand?.('copy'); }
          },
        },
        {
          label: '⬇️ ذخیره‌ی فایل', keepOpen: true,
          onClick: () => {
            try {
              const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'nardbaz-backup.json' });
              document.body.appendChild(a);
              a.click();
              a.remove();
            } catch (_) { /* کاربر می‌تواند از کپی استفاده کند */ }
          },
        },
        { label: 'بستن', kind: 'primary' },
      ],
    });
  }

  restoreDialog() {
    const ta = h('textarea', { placeholder: 'متن پشتیبان را اینجا بچسبانید…' });
    const file = h('input', { type: 'file', accept: '.json,application/json' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (f) ta.value = await f.text();
    });
    modal({
      title: 'بازیابی اطلاعات',
      body: h('div', {}, h('p', { class: 'muted' }, 'اطلاعات فعلی با پشتیبان جایگزین می‌شود.'), file, ta),
      buttons: [
        {
          label: 'بازیابی', kind: 'primary', keepOpen: true,
          onClick: () => {
            try {
              store.importBackup(ta.value);
              this.reloadSettings();
              document.querySelectorAll('.modal-back').forEach((n) => n.remove());
              this.showMenu();
              modal({ body: 'اطلاعات با موفقیت بازیابی شد.', buttons: [{ label: 'باشه', kind: 'primary' }] });
            } catch (e) {
              modal({ body: e.message, buttons: [{ label: 'باشه' }] });
            }
          },
        },
        { label: 'انصراف' },
      ],
    });
  }

  // ---------- درباره ----------
  about(c) {
    c.append(
      this.header('درباره‌ی بازی'),
      h('div', { class: 'scroll', style: { flex: 1 } }, h('div', { class: 'page card about' },
        h('h2', { style: { color: 'var(--accent)', textAlign: 'center' } }, 'نردباز'),
        h('p', {}, 'نردباز یک بازی کامل تخته‌نرد دوبعدی فارسی است؛ با قوانین استاندارد، سه سطح هوش مصنوعی، بازی دونفره‌ی آفلاین و آموزش قدم‌به‌قدم تعاملی.'),
        h('ul', {},
          h('li', {}, 'کاملاً آفلاین؛ بدون نیاز به اینترنت'),
          h('li', {}, 'قوانین کامل: زدن، Bar، خارج کردن، گامون و بک‌گامون'),
          h('li', {}, 'آموزش ۶ فصلی و تمرین‌های موضوعی'),
          h('li', {}, 'ذخیره‌ی خودکار بازی و امکان پشتیبان‌گیری'),
        ),
        h('p', { class: 'muted' }, 'نسخه‌ی ۱٫۰٫۰'),
        h('p', {}, 'ساخته‌شده توسط محمدطاها طاهریان'),
      )),
    );
  }
}

const LOGO_SVG = `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <polygon points="6,8 30,8 18,70" fill="#9c3a2b"/><polygon points="34,8 58,8 46,70" fill="#f1deb4"/>
  <polygon points="62,8 86,8 74,70" fill="#9c3a2b"/><polygon points="90,8 114,8 102,70" fill="#f1deb4"/>
  <circle cx="18" cy="78" r="11" fill="#2a2a2e" stroke="#000"/><circle cx="46" cy="78" r="11" fill="#f4ecd8" stroke="#8c7a52"/>
  <circle cx="74" cy="78" r="11" fill="#2a2a2e" stroke="#000"/><circle cx="102" cy="78" r="11" fill="#f4ecd8" stroke="#8c7a52"/>
</svg>`;
