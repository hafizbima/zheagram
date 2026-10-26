/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#f8fafc',
          grid: '#cbd5e1',
          selection: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};
