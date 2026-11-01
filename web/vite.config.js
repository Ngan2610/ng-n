import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' để chạy được khi đặt web ở thư mục con (ví dụ GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react()],
  // 'es': whisper.worker.js dùng import() động (từ thư viện @xenova/transformers) để tải
  // đúng backend WebAssembly cần thiết — định dạng mặc định 'iife' của Vite không hỗ trợ việc này.
  worker: { format: 'es' },
  test: {
    environment: 'jsdom', // giả lập trình duyệt để test giao diện
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },
  },
});
