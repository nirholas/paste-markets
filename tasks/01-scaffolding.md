# Task 01: Project Scaffolding + Design System

## Goal
Set up the Next.js project from scratch with all dependencies, config, fonts, and shared UI components. Every other task depends on this foundation.

## Priority
**RUN THIS FIRST** — other agents need the project structure to exist.

## Steps

### 1. Initialize Next.js project
```bash
cd /workspaces/agent-payments-sdk/paste-dashboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

If the directory isn't empty, initialize manually:
```bash
npm init -y
npm install next@latest react@latest react-dom@latest typescript @types/react @types/react-dom
npm install -D tailwindcss postcss autoprefixer eslint eslint-config-next
npx tailwindcss init -p
```

### 2. Install additional dependencies
```bash
npm install better-sqlite3 @vercel/og
npm install -D @types/better-sqlite3
```

### 3. Configure TypeScript
`tsconfig.json` — strict mode, path aliases:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4. Configure Tailwind
`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
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
        neutral: "#f39c12",
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
```

### 5. Set up fonts
Download JetBrains Mono woff2 files to `public/fonts/` OR use next/font/google:

In `src/app/layout.tsx`:
```typescript
import { JetBrains_Mono } from "next/font/google";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});
```

### 6. Global styles
`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #0a0a1a;
  color: #c8c8d0;
}

/* Win rate bar characters */
.win-bar-filled::before { content: "█"; }
.win-bar-empty::before { content: "░"; }

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0a0a1a; }
::-webkit-scrollbar-thumb { background: #1a1a2e; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #555568; }
```

### 7. Root layout
`src/app/layout.tsx` — apply font, dark background, basic metadata:
```typescript
export const metadata = {
  title: "paste.rank — CT Trader Leaderboard",
  description: "Real P&L rankings for Crypto Twitter traders. Powered by paste.trade.",
  openGraph: {
    title: "paste.rank — CT Trader Leaderboard",
    description: "Real P&L rankings for Crypto Twitter traders.",
    siteName: "paste.rank",
  },
  twitter: {
    card: "summary_large_image",
  },
};
```

### 8. Create shared UI components

#### `src/components/ui/nav.tsx`
Top navigation bar with:
- Logo/brand: "paste.rank" in JetBrains Mono, bold
- Links: Leaderboard, Head-to-Head, Wrapped, What's The Trade?
- Search input (handle search)
- Dark bg, border-bottom #1a1a2e

#### `src/components/ui/card.tsx`
Reusable card wrapper: bg-surface, border, rounded-lg, padding.

#### `src/components/ui/badge.tsx`
Small labels for direction (LONG/SHORT/YES/NO), platform, rank position.
- LONG/YES: green border
- SHORT/NO: red border

#### `src/components/ui/pnl-display.tsx`
Renders P&L percentage with correct color and sign:
```typescript
interface PnlDisplayProps {
  value: number;
  size?: "sm" | "md" | "lg";
}
// +12.3% in green, -5.1% in red
```

#### `src/components/ui/win-rate-bar.tsx`
Visual bar using block characters: `████████░░` (filled = win %, empty = remainder)
```typescript
interface WinRateBarProps {
  percentage: number; // 0-100
}
```

#### `src/components/ui/search-input.tsx`
Handle search input with @ prefix, autocomplete optional.

### 9. Create placeholder pages
Create minimal placeholder files for every route so the app compiles:
- `src/app/page.tsx` — "paste.rank — Coming Soon"
- `src/app/leaderboard/page.tsx` — "Leaderboard"
- `src/app/[author]/page.tsx` — "Author Profile"
- `src/app/vs/[a]/[b]/page.tsx` — "Head to Head"
- `src/app/wrapped/[author]/page.tsx` — "CT Wrapped"
- `src/app/trade/page.tsx` — "What's The Trade?"

Each placeholder should use the layout, nav, and show the page name.

### 10. Create config files

`.env.example`:
```
PASTE_TRADE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

`.gitignore`:
```
node_modules/
.next/
.env
.env.local
src/data/*.sqlite
*.sqlite
```

`src/lib/constants.ts`:
```typescript
export const COLORS = {
  win: "#2ecc71",
  loss: "#e74c3c",
  neutral: "#f39c12",
  accent: "#3b82f6",
} as const;

export const SITE_NAME = "paste.rank";
export const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
export const PASTE_TRADE_BASE = "https://paste.trade";
```

### 11. Verify it runs
```bash
cd /workspaces/agent-payments-sdk/paste-dashboard
npm run dev
```
Should start on localhost:3000 with dark theme, nav, and placeholder content.

## Done when
- `npm run dev` starts without errors
- All placeholder pages render
- Nav links work
- Tailwind classes apply correctly (dark theme visible)
- Font loads (JetBrains Mono)
- All shared UI components exist and export properly
- `.env.example` and `.gitignore` are in place
