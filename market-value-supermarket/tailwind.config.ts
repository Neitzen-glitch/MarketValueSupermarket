import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette split: 60% off-white, 30% brown, 10% peach
        cream: { DEFAULT: '#FAF5EE', light: '#FFFCF8', dark: '#F0E6D8' },
        brown: { DEFAULT: '#5A3825', light: '#8A6450', dark: '#3E2518' },
        peach: { DEFAULT: '#FFB997', light: '#FFE3D4', dark: '#F29B72' },
      },
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
