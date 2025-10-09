// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [], // ตรงนี้ควรจะเป็น array เปล่า หรือมี plugins ของ tailwind เช่น @tailwindcss/forms
}