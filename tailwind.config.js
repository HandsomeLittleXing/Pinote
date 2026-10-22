/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sticker: {
          yellow: '#FFF9C4',
          blue: '#BBDEFB',
          green: '#C8E6C9',
          pink: '#F8BBD0',
          orange: '#FFE0B2',
          purple: '#E1BEE7',
          white: '#FFFFFF',
          gray: '#E0E0E0',
        },
      },
      borderRadius: {
        sticker: '8px',
      },
      minWidth: {
        sticker: '160px',
      },
      minHeight: {
        sticker: '120px',
      },
    },
  },
  plugins: [],
};
