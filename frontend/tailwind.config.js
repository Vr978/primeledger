/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f8fafc',
          100: '#1e1e2e',
          200: '#1a1a2a',
          300: '#16162a',
          400: '#121224',
          500: '#0e0e1e',
          600: '#0a0a18',
          700: '#060612',
          800: '#04040e',
          900: '#020208',
        },
        accent: {
          red: '#e53e3e',
          green: '#38a169',
          blue: '#4299e1',
        }
      }
    },
  },
  plugins: [],
}
