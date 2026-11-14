// ذخیره‌سازی محلی (localStorage) با پشتیبان حافظه برای زمانی که در دسترس نیست
const PREFIX = 'nardbaz.';
const mem = new Map();

function rawGet(key) {
  try {
    const v = globalThis.localStorage?.getItem(PREFIX + key);
    if (v !== null && v !== undefined) return v;
  } catch (_) {
    /* ignore */
  }
  return mem.has(key) ? mem.get(key) : null;
}
function rawSet(key, value) {
  mem.set(key, value);
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch (_) {
    /* ignore */
  }
}
function rawDel(key) {
  mem.delete(key);
  try {
    globalThis.localStorage?.removeItem(PREFIX + key);
  } catch (_) {
    /* ignore */
  }
}

export function load(key, fallback) {
  const v = rawGet(key);
  if (v === null) return fallback;
  try {
    return JSON.parse(v);
  } catch (_) {
    return fallback;
  }
}
export function save(key, value) {
  rawSet(key, JSON.stringify(value));
}
export function remove(key) {
  rawDel(key);
}

export const DEFAULT_SETTINGS = {
  sound: true,
  volume: 0.7,
  difficulty: 'medium',
  hints: true,
  theme: 'dark',
  animSpeed: 'normal', // slow | normal | fast
  tutorialMessages: true,
};
export const DEFAULT_STATS = {
  ai: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } },
  local: { games: 0 },
  points: 0, // مجموع امتیاز برد مقابل هوش مصنوعی
  gammons: 0,
  backgammons: 0,
  bestStreak: 0,
  streak: 0,
  fastestWinMoves: null, // کمترین تعداد حرکت در یک برد
};
export const DEFAULT_PROGRESS = { lessons: {}, practice: {} };

export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...load('settings', {}) });
export const setSettings = (s) => save('settings', s);
export const getStats = () => {
  const s = load('stats', {});
  return { ...structuredClone(DEFAULT_STATS), ...s, ai: { ...DEFAULT_STATS.ai, ...(s.ai || {}) } };
};
export const setStats = (s) => save('stats', s);
export const getProgress = () => ({ ...structuredClone(DEFAULT_PROGRESS), ...load('progress', {}) });
export const setProgress = (p) => save('progress', p);
export const getSavedGame = () => load('savedGame', null);
export const setSavedGame = (g) => save('savedGame', g);
export const clearSavedGame = () => remove('savedGame');

export function clearAll() {
  for (const k of ['settings', 'stats', 'progress', 'savedGame']) rawDel(k);
}

// ---- پشتیبان‌گیری ----
export function exportBackup() {
  return JSON.stringify(
    {
      app: 'nardbaz',
      version: 1,
      date: new Date().toISOString(),
      settings: getSettings(),
      stats: getStats(),
      progress: getProgress(),
      savedGame: getSavedGame(),
    },
    null,
    2,
  );
}

export function importBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error('فایل پشتیبان معتبر نیست.');
  }
  if (!data || data.app !== 'nardbaz') throw new Error('این فایل مربوط به نردباز نیست.');
  if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  if (data.stats) setStats(data.stats);
  if (data.progress) setProgress(data.progress);
  if (data.savedGame) setSavedGame(data.savedGame);
  else clearSavedGame();
}
