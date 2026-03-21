import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        surface: "#111111",
        "surface-2": "#1a1a1a",
        border: "#ffffff0d",
        "border-light": "#ffffff14",
        "text-primary": "#f5f5f7",
        "text-secondary": "#a1a1aa",
        "text-muted": "#52525b",
        win: "#22c55e",
        loss: "#ef4444",
        amber: "#f59e0b",
        accent: "#0066FF",
        "accent-2": "#3385FF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
