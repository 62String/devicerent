import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0', // 외부 접속 허용
    port: 3000,
    open: false,
    hmr: { overlay: false }, // 에러 오버레이 비활성화 (선택)
  },
  envDir: './',
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  build: {
    target: 'esnext',
  },
});