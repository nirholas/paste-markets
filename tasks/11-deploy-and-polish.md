# Task 11: Deployment Config + Integration Polish

## Goal
Make the project production-ready: Vercel deployment config, environment setup, error boundaries, loading states, and integration testing across all pages. Make sure everything works together.

## Files to create/modify
- `vercel.json`
- `next.config.ts` (update if needed)
- `src/app/error.tsx` (global error boundary)
- `src/app/loading.tsx` (global loading state)
- `src/app/not-found.tsx` (404 page)
- `src/middleware.ts` (optional: handle redirects, rate limiting)
- `package.json` (verify scripts)

## 1. Vercel Configuration

`vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "PASTE_TRADE_KEY": "@paste-trade-key",
    "ANTHROPIC_API_KEY": "@anthropic-api-key"
  },
  "headers": [
    {
      "source": "/api/og/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=3600" }
      ]
    }
  ]
}
```

## 2. Next.js Config

`next.config.ts`:
```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  images: {
    domains: ["pbs.twimg.com", "abs.twimg.com"], // if we show twitter avatars
  },
  async redirects() {
    return [
      {
        source: "/@:handle",
        destination: "/:handle",
        permanent: true,
      },
    ];
  },
};

export default config;
```

Key: `better-sqlite3` must be in `serverComponentsExternalPackages` because it's a native module that can't be bundled by Webpack.

## 3. Error Boundary

`src/app/error.tsx`:
```typescript
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Something went wrong</h1>
        <p className="text-text-muted mb-6">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="border border-border hover:border-accent px-4 py-2 rounded transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

## 4. Loading State

`src/app/loading.tsx`:
```typescript
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-muted animate-pulse">
        Loading...
      </div>
    </div>
  );
}
```

Also create loading states for each route group:
- `src/app/leaderboard/loading.tsx` — skeleton table
- `src/app/[author]/loading.tsx` — skeleton scorecard
- `src/app/vs/[a]/[b]/loading.tsx` — skeleton comparison
- `src/app/wrapped/[author]/loading.tsx` — skeleton wrapped card

## 5. 404 Page

`src/app/not-found.tsx`:
```typescript
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
        <p className="text-text-muted mb-6">Page not found.</p>
        <Link href="/" className="border border-border hover:border-accent px-4 py-2 rounded transition">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
```

## 6. Middleware (optional)

`src/middleware.ts`:
```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Handle @handle redirects
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/@")) {
    const handle = pathname.slice(2);
    return NextResponse.redirect(new URL(`/${handle}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## 7. Package.json scripts
Verify these scripts exist:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:seed": "tsx src/lib/seed.ts"
  }
}
```

## 8. Integration verification
Walk through each page and verify:

### Landing page (`/`)
- [ ] Renders without errors
- [ ] Search navigates to author profile
- [ ] Feature cards link to correct pages
- [ ] Trending section shows data (or graceful empty state)

### Leaderboard (`/leaderboard`)
- [ ] Table renders with data
- [ ] Filters work (timeframe, sort, min trades)
- [ ] Pagination works
- [ ] Clicking row navigates to profile
- [ ] Empty state handled

### Author profile (`/frankdegods`)
- [ ] Scorecard renders with metrics
- [ ] Trade history table shows
- [ ] Action buttons work
- [ ] Unknown author shows "not found" state
- [ ] OG image generates

### Head-to-head (`/vs/frankdegods/nichxbt`)
- [ ] Comparison renders
- [ ] Winner highlighting works
- [ ] Shared tickers show
- [ ] Handle inputs allow changing matchup
- [ ] OG image generates

### CT Wrapped (`/wrapped/frankdegods`)
- [ ] Personality assigned
- [ ] Grades display
- [ ] Fun facts generate
- [ ] "Try yours" input works
- [ ] OG image generates

### What's The Trade (`/trade`)
- [ ] Input accepts URLs and text
- [ ] Loading state shows
- [ ] Results display as cards
- [ ] Error handling for failed analysis
- [ ] Pre-filled URL support works

### OG Images
- [ ] All 6 types generate at 1200x630
- [ ] Font renders correctly
- [ ] Dynamic data shows
- [ ] Cache headers set

## 9. Fix common issues
- **SQLite on Vercel:** better-sqlite3 needs `serverComponentsExternalPackages`. If deploy fails, consider switching to Vercel KV or Turso (libsql) for production.
- **Font loading in OG:** If JetBrains Mono fails to load in Edge runtime, fall back to a system font or fetch from Google Fonts CDN.
- **API routes failing:** Ensure all env vars are set in Vercel dashboard.
- **Build errors from missing types:** Add any missing type imports or interfaces.

## 10. Final touches
- Favicon: Create a simple dark favicon (can be a plain dark square with "p" or leave as Next.js default)
- Add `robots.txt` to `public/`:
  ```
  User-agent: *
  Allow: /
  ```
- Verify all pages have proper `<title>` and `<meta description>`

## Done when
- `npm run build` succeeds without errors
- All pages render correctly
- Error boundaries catch and display errors gracefully
- Loading states show during data fetching
- 404 page works for unknown routes
- OG images generate for all page types
- Vercel config is ready for deployment
- All integration checks pass
