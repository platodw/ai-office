import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#faf6ef",
        surface: "#f0e9dc",
        "surface-2": "#ffffff",
        border: "#ddd1bd",
        "border-2": "#c8b89a",
        text: "#1f1a14",
        "text-2": "#3d342a",
        muted: "#8a7d6e",
        subtle: "#8a7d6e",
        primary: "#8a6a2e",
        "primary-dark": "#6f5424",
        "primary-soft": "#ebe1c9",
        success: "#3a8a52",
        error: "#b04545",
        warning: "#c08a2e",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
