export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        navy: {
          50: '#f1f4fb',
          100: '#dde4f4',
          400: '#42558c',
          500: '#2c3e73',
          600: '#1e2d59',
          700: '#162244',
          800: '#101833',
          900: '#0a1026',
        },
        brand: {
          50: '#eff4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#608ffa',
          500: '#3b6df6',
          600: '#2354e8',
          700: '#1b41d4',
          800: '#1c37ab',
          900: '#1d3387',
        },
        accent: {
          500: '#f97316',
          600: '#ea580c',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 51, 0.06), 0 1px 3px rgba(16, 24, 51, 0.08)',
        panel: '0 8px 24px rgba(16, 24, 51, 0.10)',
      },
    },
  },
}
