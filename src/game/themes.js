// پوسته‌های مختلف تخته‌ی بازی (فقط رنگ‌ها؛ هندسه و قوانین یکسان است)
export const BOARD_THEMES = {
  walnut: {
    name: 'چوب گردو', outer: '#2a1a10', frame: ['#8a5a34', '#7a4c2b', '#693f23'], frameStroke: '#3b2415',
    field: ['#c99a62', '#b8864f'], fieldStroke: '#4a2d18', pA: '#9c3a2b', pAs: '#6f261b', pB: '#f1deb4', pBs: '#d2b883',
    bar: '#5b3820', barLine: '#7a4c2b', tray: '#3a2414', trayStroke: '#1d110a', orn: '#6b4326', num: '#f1deb4',
  },
  maple: {
    name: 'چوب روشن', outer: '#5b3d22', frame: ['#ebc896', '#e0b680', '#d4a56a'], frameStroke: '#a87b45',
    field: ['#f1d3a6', '#e7bf88'], fieldStroke: '#b88a52', pA: '#85613c', pAs: '#634527', pB: '#fbebcb', pBs: '#dfc597',
    bar: '#caa070', barLine: '#a87b45', tray: '#8c1d2d', trayStroke: '#5a111c', orn: '#b88a52', num: '#4a2f16',
  },
  ebony: {
    name: 'آبنوس و طلا', outer: '#0c0c0e', frame: ['#3d3d43', '#32323a', '#26262c'], frameStroke: '#101012',
    field: ['#585a60', '#494b51'], fieldStroke: '#1b1b1e', pA: '#c9a14a', pAs: '#8a6d2a', pB: '#e9e3d3', pBs: '#bcb49c',
    bar: '#1f1f23', barLine: '#3a3a40', tray: '#17171a', trayStroke: '#050506', orn: '#8a6d2a', num: '#e9e3d3',
  },
  green: {
    name: 'نمد سبز', outer: '#170d07', frame: ['#5c3b22', '#4e311c', '#43291a'], frameStroke: '#2a180e',
    field: ['#2f7d52', '#266b44'], fieldStroke: '#17402a', pA: '#8e2d2d', pAs: '#5e1c1c', pB: '#e9e0c6', pBs: '#bdb28c',
    bar: '#43291a', barLine: '#5c3b22', tray: '#2b1a10', trayStroke: '#150b05', orn: '#1d5a39', num: '#e9e0c6',
  },
  blue: {
    name: 'آبی شب', outer: '#080e1f', frame: ['#33477a', '#2a3b68', '#1f2d52'], frameStroke: '#0f1830',
    field: ['#7389ba', '#6178ad'], fieldStroke: '#26355e', pA: '#1f2f5c', pAs: '#131e3d', pB: '#e7edf9', pBs: '#b3bfd8',
    bar: '#1c2a4d', barLine: '#32477a', tray: '#131c36', trayStroke: '#0a1020', orn: '#3d5088', num: '#dbe4f7',
  },
  persian: {
    name: 'فیروزه‌ای ایرانی', outer: '#082426', frame: ['#23807f', '#1b6b6c', '#14575a'], frameStroke: '#0b3a3c',
    field: ['#f1e2bf', '#e4d1a0'], fieldStroke: '#a68a4f', pA: '#1e7a7d', pAs: '#135558', pB: '#d9a441', pBs: '#a87c25',
    bar: '#14575a', barLine: '#23807f', tray: '#0f4244', trayStroke: '#082a2c', orn: '#a68a4f', num: '#f3e6c3',
  },
};
export const BOARD_THEME_IDS = Object.keys(BOARD_THEMES);
