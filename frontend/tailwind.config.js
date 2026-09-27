/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        '5.5': '1.375rem',
      },
      colors: {
        cream: "#FAFAF7",
        navy: "#0D1B2A",
        "navy-blue": "#1B4F8A",
        card: "#FFFFFF",
        border: "#E8E8E0"
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
