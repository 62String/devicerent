import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: './',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
  },
  server: {
    port: 3000,
    open: false,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  build: {
    target: 'esnext',
  },
});