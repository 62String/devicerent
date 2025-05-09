import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // v4용 플러그인

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // v4 플러그인 사용
  ],
  server: {
    host: true, //외부 접속 허용
    port: 3000
  },
  envDir: './',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
  },
  server: {
    port: 3000,
    open: false,
    hmr: { overlay: false }, // 에러 오버레이 비활성화 (선택)
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  build: {
    target: 'esnext',
  },
});