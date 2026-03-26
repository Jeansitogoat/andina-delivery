import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'rojo-andino': '#E00000',
        'dorado-oro': '#FFC107',
        ink: '#111827',
        surface: '#F8FAFC',
        'surface-card': '#FFFFFF',
        'rider-900': '#0B1F4A',
        'rider-700': '#1D4ED8',
        'rider-600': '#2563EB',
        'rider-100': '#DBEAFE',
        'rider-accent': '#22D3EE',
        'primary-strong': '#1D4ED8',
        'primary-soft': '#DBEAFE',
      },
      spacing: {
        'safe': '1rem',
        'safe-lg': '1.25rem',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(15, 23, 42, 0.08)',
        softlg: '0 14px 30px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
