/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // GP Consulting color palette
        primary: {
          DEFAULT: '#1a365d',
          50: '#f0f4f8',
          100: '#e2e8f0',
          200: '#c3d0e0',
          300: '#94a9c2',
          400: '#5c7a9e',
          500: '#2c5282',
          600: '#1a365d',
          700: '#152a4d',
          800: '#11223f',
          900: '#0d1a30',
          dark: '#152a4d',
          light: '#2c5282',
        },
        accent: {
          DEFAULT: '#3182ce',
          50: '#ebf8ff',
          100: '#bee3f8',
          200: '#90cdf4',
          300: '#63b3ed',
          400: '#4299e1',
          500: '#3182ce',
          600: '#2b6cb0',
          700: '#2c5282',
          800: '#2a4365',
          900: '#1a365d',
          light: '#4299e1',
        },
        // Semantic colors
        background: {
          DEFAULT: '#f0f4f8',
          alt: '#e2e8f0',
        },
        text: {
          DEFAULT: '#1a2a3a',
          secondary: '#2d3748',
          muted: '#718096',
        },
        border: '#e2e8f0',
      }
    },
  },
  plugins: [],
}
