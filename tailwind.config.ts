import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#191919", muted: "#6b6b6b", subtle: "#9b9b9b" },
        surface: { DEFAULT: "#ffffff", alt: "#fafafa", hover: "#f4f4f4" },
        line: { DEFAULT: "#e9e9e7", strong: "#d3d3d1" },
        // акцентный — взят из логотипа (тёмно-синий)
        brand: { DEFAULT: "#1a0088", muted: "#372a9a" },
      },
    },
  },
  plugins: [],
};

export default config;
