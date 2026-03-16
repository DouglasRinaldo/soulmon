import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',

  build: {
    outDir: 'dist',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: 'index.html',
    }
  },

  server: {
    port: 5173,
    open: false,
  },

  // Pasta public: tudo que está aqui é copiado direto para dist/
  // sem processamento. Perfeito para os JSONs e scripts externos.
  publicDir: 'public',
});
