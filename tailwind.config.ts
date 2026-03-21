import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#12121a",
        "surface-2": "#1a1a24",
        border: "#ffffff0d",
        "border-light": "#ffffff14",
        "text-primary": "#f5f5f7",
        "text-secondary": "#a1a1aa",
        "text-muted": "#52525b",
        win: "#22c55e",
        loss: "#ef4444",
        amber: "#f59e0b",
        accent: "#6366f1",
        "accent-2": "#8b5cf6",
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
