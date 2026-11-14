import { defineConfig } from 'vite';

// base نسبی برای اینکه بازی داخل Capacitor و هر مسیر وب اجرا شود.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 1200 },
  worker: { format: 'es' },
});
