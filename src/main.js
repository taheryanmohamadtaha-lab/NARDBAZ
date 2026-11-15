// فونت وزیرمتن (OFL) از بسته‌ی npm ساخته می‌شود و داخل APK قرار می‌گیرد؛ بازی آفلاین است.
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/700.css';
import { App } from './ui/app.js';

window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App(document.getElementById('app'));
});
