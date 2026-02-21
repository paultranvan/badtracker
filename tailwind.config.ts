import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1e40af',
          light: '#93c5fd',
          bg: '#eff6ff',
          surface: '#f0f7ff',
        },
        win: {
          DEFAULT: '#16a34a',
          bg: '#dcfce7',
        },
        loss: {
          DEFAULT: '#dc2626',
          bg: '#fee2e2',
        },
        singles: '#3b82f6',
        doubles: '#10b981',
        mixed: '#f59e0b',
        surface: '#f8fafc',
        muted: '#64748b',
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        title: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '22px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
