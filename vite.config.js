import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cloudflare Pages: build command `npm run build`, output directory `dist`
export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` 중에 /api/* 요청을 로컬 Pages Functions(wrangler, 8788)로 전달
    // (npm run pages:dev 를 다른 터미널에서 실행 중일 때만 동작)
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
  build: {
    outDir: 'dist',
  },
});
