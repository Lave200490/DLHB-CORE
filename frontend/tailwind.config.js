/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "navy": {
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#b2cce4",
          300: "#6fa3d0",
          400: "#3d5a80",
          500: "#1e3a5f",
          600: "#0f2438",
          700: "#0a1929",
          800: "#061a3d",
          900: "#030d1a",
        },
      },
    },
  },
  plugins: [],
}
