export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        navy: {
          50: '#f5f5f7',
          100: '#ececee',
          200: '#dedee2',
          400: '#86868b',
          500: '#6e6e73',
          600: '#424245',
          700: '#333336',
          800: '#2c2c2e',
          900: '#1d1d1f',
        },
        brand: {
          50: '#e8f2ff',
          100: '#d2e6ff',
          200: '#a9cdff',
          300: '#6fa8ff',
          400: '#2f83fc',
          500: '#0071e3',
          600: '#0062c4',
          700: '#0055a8',
          800: '#004a92',
          900: '#003e7a',
        },
        accent: {
          500: '#f97316',
          600: '#ea580c',
        },
      },
      boxShadow: {
        card: '0 1px 1px rgba(0, 0, 0, 0.03), 0 2px 8px rgba(0, 0, 0, 0.04)',
        panel: '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
    },
  },
}