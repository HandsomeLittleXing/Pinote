/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 语义色：统一来自 tokens.css，支持 /opacity 修饰符
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        'ink-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'ink-subtle': 'rgb(var(--text-subtle) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        // 便签色板：Phase 1 再迁移，先保留现有值
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
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        sticker: '8px',
      },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        float: 'var(--shadow-float)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
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
