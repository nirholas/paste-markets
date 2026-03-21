import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a1a",
        surface: "#0f0f22",
        border: "#1a1a2e",
        "text-primary": "#f0f0f0",
        "text-secondary": "#c8c8d0",
        "text-muted": "#555568",
        win: "#2ecc71",
        loss: "#e74c3c",
        amber: "#f39c12",
        accent: "#3b82f6",
      },
      fontFamily: {
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
