/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#f7fde2',
          100: '#eefbc0',
          200: '#ddf785',
          300: '#d0f255',
          400: '#c4e632',
          500: '#b8d41e',
          600: '#92aa14',
          700: '#6e800f',
          800: '#4a5509',
          900: '#2b3205',
          950: '#151a02'
        },
        surface: {
          DEFAULT: '#0a0a0c',
          50: '#101012',
          100: '#161618',
          200: '#1e1e21',
          300: '#28282c',
          400: '#343438',
          500: '#48484e'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
}
