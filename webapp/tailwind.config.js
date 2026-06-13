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
        // "Refined consulting" — navy ink, sparing blue accent, warm-cool neutrals.
        ink: '#13243b',
        primary: {
          DEFAULT: '#1a365d',
          50: '#f2f5f9',
          100: '#e2e9f1',
          200: '#c3d0e0',
          300: '#94a9c2',
          400: '#5c7a9e',
          500: '#2c5282',
          600: '#1a365d',
          700: '#152a4d',
          800: '#11233f',
          900: '#0d1a30',
          dark: '#11233f',
          light: '#2c5282',
        },
        accent: {
          DEFAULT: '#2b6cb0',
          soft: '#ebf1f8',
          50: '#eff5fb',
          100: '#d8e6f4',
          200: '#b3cde8',
          300: '#86afd8',
          400: '#5a8fc6',
          500: '#2b6cb0',
          600: '#225789',
          700: '#1c4670',
          800: '#173a5c',
          900: '#13304b',
        },
        // Muted "data-ink" effect ramp (Direct / Indirect / Induced)
        effect: {
          direct: '#1a365d',
          indirect: '#5278a0',
          induced: '#9bb0c8',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f7f8fa',
          raised: '#ffffff',
        },
        paper: '#f7f8fa',
        hairline: '#e5e8ed',
        positive: '#2f7a55',
        negative: '#b04a3f',
        highlight: '#b07a2b',
        text: {
          DEFAULT: '#13243b',
          secondary: '#3a4756',
          muted: '#6b7785',
          faint: '#9aa4b1',
        },
        border: '#e5e8ed',
      },
      boxShadow: {
        // Restrained, report-grade elevation — hairline + a whisper of depth.
        card: '0 1px 2px rgba(19, 36, 59, 0.04)',
        raised: '0 4px 16px rgba(19, 36, 59, 0.07)',
        pop: '0 8px 28px rgba(19, 36, 59, 0.12)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
}
