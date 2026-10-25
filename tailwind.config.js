/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          950: '#071a22',
          900: '#0b2530',
          800: '#113441',
          700: '#1a4956',
          600: '#286272',
        },
        frost: {
          50: '#f7fafb',
          100: '#eef4f5',
          200: '#dce8ea',
          300: '#c5d8db',
        },
        mint: {
          300: '#7ee8d2',
          400: '#40d7bd',
          500: '#17bda3',
          600: '#0d9986',
          700: '#087a6c',
        },
        ember: {
          400: '#ffb45c',
          500: '#f58b2e',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(7, 26, 34, 0.04), 0 12px 32px rgba(7, 26, 34, 0.06)',
        float: '0 20px 50px rgba(7, 26, 34, 0.16)',
      },
      backgroundImage: {
        'instrument-grid':
          'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.2,.8,.2,1) both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
