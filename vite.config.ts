import { defineConfig } from 'vite';

export default defineConfig({
  // Relative Pfade, damit die App auch in der Android-WebView die Dateien findet
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
});
