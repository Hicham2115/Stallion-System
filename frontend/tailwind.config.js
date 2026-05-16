/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8ee',
          100: '#f9edcc',
          200: '#f3d895',
          300: '#ecbe5c',
          400: '#e8a832',
          500: '#d4891a',
          600: '#b86b13',
          700: '#8f4d12',
          800: '#753f15',
          900: '#623516',
          950: '#371a08',
        },
        stallion: {
          dark: '#0a0f1e',
          navy: '#0f172a',
          blue: '#1e3a8a',
          gold: '#f59e0b',
          light: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
};
