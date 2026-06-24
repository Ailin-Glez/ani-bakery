/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FDF8F5',
        'cream-light': '#FFFCFA',
        'brown-dark': '#2D1B1B',
        'brown-mid': '#5C3535',
        'brown-light': '#8B6060',
        wine: '#6B7A50',
        'wine-dark': '#4E5C3A',
        rose: '#C8D4B0',
        'rose-light': '#EBF0E2',
        beige: '#C4CDB0',
        'beige-light': '#EEF2E6',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Raleway', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
