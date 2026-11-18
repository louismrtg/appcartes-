/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: {
          light: '#F7F8FA',
          dark: '#0D0E12',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#16181F',
        },
      },
      boxShadow: {
        card: '0 12px 30px -10px rgba(15, 23, 42, 0.25), 0 4px 10px -4px rgba(15, 23, 42, 0.12)',
        sheet: '0 -10px 40px -10px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
};
