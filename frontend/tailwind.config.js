/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'], darkMode: 'class',
  theme: {
    extend: {
      colors: {
        runway: {
          950: '#0B1B2B',
          900: '#0F2438',
          800: '#16334D',
          700: '#1F4463',
        },
        signal: {
          500: '#1B8A7E',
          600: '#146F65',
        },
        amber: {
          400: '#E8A33D',
          500: '#D98F22',
        },
        mist: {
          50: '#F6F8FA',
          100: '#EEF1F5',
          200: '#DDE3EA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Libre Franklin"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
