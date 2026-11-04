/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        navy: "#10172b",
        brand: "#5b67f1",
        mint: "#25c59a",
        canvas: "#f6f7fb",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 6px 24px rgba(27, 38, 77, 0.055)",
        lift: "0 20px 60px rgba(19, 28, 57, 0.16)",
      },
    },
  },
  plugins: [],
};
