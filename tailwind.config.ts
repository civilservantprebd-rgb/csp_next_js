import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Kalpurush", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        bengali: ["Kalpurush", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      /* ধাপে ধাপে বড়, পরিষ্কার টাইপোগ্রাফি স্কেল (root 20px-এর সাথে):
         লেবেল < ছোট লেখা < বডি < কার্ড টাইটেল < সেকশন হেডিং < পেজ হেডিং < হিরো */
      fontSize: {
        xs: ["0.8125rem", "1.25rem"],       // ~16.3px — লেবেল/ব্যাজ
        sm: ["0.9375rem", "1.5rem"],        // ~18.8px — ছোট বডি/বিবরণ
        base: ["1.125rem", "1.75rem"],      // ~22.5px — মূল বডি টেক্সট
        lg: ["1.375rem", "1.875rem"],       // ~27.5px — কার্ড/সাবহেডিং
        xl: ["1.625rem", "2.125rem"],       // ~32.5px — সেকশন হেডিং
        "2xl": ["1.875rem", "2.375rem"],    // ~37.5px — পেজ হেডিং
        "3xl": ["2.25rem", "2.75rem"],      // ~45px   — হিরো/বড় হেডিং
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
