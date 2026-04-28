import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      letterSpacing: {
        tightish: "-0.011em",
        tighter2: "-0.025em",
      },
      colors: {
        // Notion-ish монохром
        ink: { DEFAULT: "#191919", muted: "#6b6b6b", subtle: "#9b9b9b", soft: "#b3b3b3" },
        surface: { DEFAULT: "#ffffff", alt: "#fbfbfa", hover: "#f4f4f2", muted: "#efeeec" },
        line: { DEFAULT: "#e9e9e7", strong: "#d3d3d1", soft: "#f0f0ee" },
        // Акцент бренда — ровно цвет логотипа
        brand: {
          DEFAULT: "#1a0088",
          dark: "#11005a",
          hover: "#2410a3",
          ring: "rgba(26, 0, 136, 0.45)",
          tint: "#f1eeff",
          tintStrong: "#dcd2ff",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(15, 15, 15, 0.05), 0 1px 2px rgba(15, 15, 15, 0.04)",
        cardHover:
          "0 1px 0 rgba(15, 15, 15, 0.06), 0 4px 16px -4px rgba(15, 15, 15, 0.08)",
        focusBrand: "0 0 0 3px rgba(26, 0, 136, 0.18)",
      },
      animation: {
        "fade-in": "fadeIn 240ms ease-out both",
        "slide-up": "slideUp 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up-fast": "slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scaleIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
