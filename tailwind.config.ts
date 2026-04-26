import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        c9: {
          accent: '#4F46E5',
          'accent-hover': '#4338CA',
          'accent-light': '#6366F1',
          'accent-muted': 'rgba(79,70,229,0.12)',
          'dark-bg': '#0D0D1A',
          'dark-surface': '#12122A',
          'dark-border': 'rgba(255,255,255,0.08)',
          'dark-text': '#F1F0FF',
          'dark-muted': '#8884B8',
          'light-bg': '#FAFAFA',
          'light-surface': '#F0F0FF',
          'light-border': 'rgba(79,70,229,0.15)',
          'light-text': '#0D0D1A',
          'light-muted': '#6B6896',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
} satisfies Config
