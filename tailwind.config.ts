import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effefa', 100: '#c8fff1', 200: '#91fee4', 300: '#52f4d4', 400: '#1fdfbf',
          500: '#06c3a6', 600: '#019d88', 700: '#067d6f', 800: '#0a635a', 900: '#0d524b', 950: '#003330',
        },
        ink: { DEFAULT: '#0f172a', soft: '#475569', faint: '#94a3b8' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)' },
    },
  },
  plugins: [],
};
export default config;
