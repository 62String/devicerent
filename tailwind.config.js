/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // src 폴더 내 모든 파일 포함
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)', // CSS 변수 사용 (v4 방식)
        secondary: 'var(--color-secondary)',
        success: 'var(--color-success)',
        gray: {
          100: '#F5F5F5',
          200: '#E0E0E0',
          300: '#B0B0B0',
        },
      },
    },
  },
  plugins: [],
}