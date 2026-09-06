/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--pl-paper)", surface: "var(--pl-surface)", raised: "var(--pl-raised)", sunken: "var(--pl-sunken)",
        line: "var(--pl-line)", "line-strong": "var(--pl-line-strong)", ink: "var(--pl-ink)", brass: "var(--pl-gold)", "brass-deep": "var(--pl-gold-deep)",
      },
      borderRadius: { card: "16px", sheet: "22px" },
      boxShadow: { card: "var(--pl-shadow1)" },
      screens: { desk: "900px" },
    },
  },
  plugins: [],
};
