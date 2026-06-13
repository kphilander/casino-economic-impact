/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Serif display for report-grade headings; Inter for UI/body.
        display: ['"Source Serif 4"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        // "Consulting deluxe" — deep navy ink, brass signature accent.
        ink: '#0e1d31',
        primary: {
          DEFAULT: '#1a365d',
          50: '#f2f5f9',
          100: '#e2e9f1',
          200: '#c3d0e0',
          300: '#94a9c2',
          400: '#5c7a9e',
          500: '#2c5282',
          600: '#1a365d',
          700: '#13294a',
          800: '#0f2440',
          900: '#0b1b30',
          dark: '#0f2440',
          light: '#2c5282',
        },
        accent: {
          DEFAULT: '#2563a8',
          soft: '#e9f0f9',
          50: '#eff5fb',
          100: '#d8e6f4',
          200: '#b3cde8',
          300: '#86afd8',
          400: '#5a8fc6',
          500: '#2563a8',
          600: '#1f5189',
          700: '#1a4470',
          800: '#15375b',
          900: '#112c49',
        },
        // Brass / gold signature accent
        brass: {
          DEFAULT: '#b7892f',
          soft: '#f4ecd8',
          light: '#d9af5e',
          500: '#b7892f',
          600: '#9c7424',
          700: '#7e5d1d',
        },
        // Effect ramp — FILLS (charts)
        effect: {
          direct: '#1a365d',
          indirect: '#3a78a8',
          induced: '#7aa9cb',
        },
        // Effect ramp — TEXT (darker, contrast-safe)
        effectink: {
          direct: '#1a365d',
          indirect: '#2f5d86',
          induced: '#3f6f8e',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f5f6f8',
          raised: '#ffffff',
        },
        paper: '#f5f6f8',
        hairline: '#e3e7ec',
        positive: '#2f7a55',
        negative: '#b0432f',
        highlight: '#b7892f',
        text: {
          DEFAULT: '#0e1d31',
          secondary: '#33404f',
          muted: '#5c6776',
          faint: '#8b95a3',
        },
        border: '#e3e7ec',
      },
      boxShadow: {
        card: '0 1px 2px rgba(14, 29, 49, 0.04)',
        raised: '0 6px 20px rgba(14, 29, 49, 0.08)',
        pop: '0 12px 34px rgba(14, 29, 49, 0.16)',
        hero: '0 18px 48px rgba(14, 29, 49, 0.28)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
}
