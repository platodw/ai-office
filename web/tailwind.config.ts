import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f14",
        surface: "#1a1a24",
        "surface-2": "#222230",
        border: "#2a2a3e",
        "border-2": "#3a3a50",
        text: "#e2e2e8",
        muted: "#888896",
        subtle: "#555568",
        primary: "#5b8def",
        "primary-dark": "#4070d8",
        success: "#4caf50",
        error: "#f44336",
        warning: "#ff9800",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
