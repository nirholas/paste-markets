# Task: VPS Deployment Config (Fly.io) for paste-dashboard

## Context

Repo is at `/workspaces/agent-payments-sdk/paste-dashboard/`.

paste-dashboard is a Next.js 14 app (App Router) that now uses **Playwright + Chromium** for browser-based tweet scraping (the bulk profile scanner feature). This means it **cannot be deployed to Vercel or any serverless platform** — it needs a persistent process with Chromium installed.

Deploy target: **Fly.io** (cheapest option with persistent VMs, supports Docker).

The app uses:
- Next.js 14 (App Router, TypeScript)
- SQLite via `better-sqlite3` (local file, needs persistent volume)
- Playwright + Chromium (needs system deps)
- Environment variables: `PASTE_TRADE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_BASE_URL`
- Optional session file: `config/x-session.json` (gitignored, contains X cookies)

---

## What to Build

### 1. `paste-dashboard/Dockerfile`

Multi-stage Docker build:

**Stage 1 (deps):** Install node_modules
**Stage 2 (builder):** Build Next.js app
**Stage 3 (runner):** Production image with Chromium

The runner stage must:
- Use `node:20-slim` base
- Install Chromium system deps: `chromium`, `ca-certificates`, `fonts-liberation`, `libnss3`, `libatk-bridge2.0-0`, `libdrm2`, `libxkbcommon0`, `libgbm1` (standard Playwright Linux deps)
- Install Playwright's Chromium via `npx playwright install chromium`
- Set `PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright-browsers` so it's consistent
- Copy built Next.js output from builder stage
- Create `/app/config` and `/app/data` directories
- Run as non-root user
- `EXPOSE 3000`
- `CMD ["node", "server.js"]` (Next.js standalone output)

Enable Next.js standalone output in `next.config.ts`:
```ts
output: 'standalone'
```

### 2. `paste-dashboard/fly.toml`

Fly.io config:
- App name: `paste-markets` (or `paste-markets-app` if taken)
- Region: `ord` (Chicago — low latency for US users)
- 1 machine, `shared-cpu-1x` with **512MB RAM** (Chromium needs it)
- Internal port 3000, force HTTPS
- Health check: `GET /api/health` every 30s
- **Persistent volume** mounted at `/app/data` for SQLite (1GB)
- **Persistent volume** mounted at `/app/config` for `x-session.json` (1GB, same volume or separate)
- Set `NODE_ENV=production`
- Leave secrets blank in the file (set via `fly secrets set`)

### 3. `paste-dashboard/src/app/api/health/route.ts`

Simple health check endpoint:
```ts
GET /api/health → { ok: true, timestamp: "..." }
```

Returns 200. Used by Fly.io health checks.

### 4. `paste-dashboard/.dockerignore`

Exclude:
- `node_modules`
- `.next`
- `config/x-session.json`
- `config/*.png`
- `data/*.sqlite`
- `.env`
- `.env.local`

### 5. `paste-dashboard/docs/DEPLOY.md`

Deployment runbook covering:

**First deploy:**
```bash
cd paste-dashboard
fly launch --no-deploy        # creates fly.toml, links to Fly.io app
fly volumes create data --size 1 --region ord
fly secrets set PASTE_TRADE_KEY=... ANTHROPIC_API_KEY=... NEXT_PUBLIC_BASE_URL=https://paste-markets.fly.dev
fly deploy
```

**Uploading X session cookie** (required for Playwright scraping):
```bash
# 1. Export session using DevTools script:
#    Open x.com in Chrome, paste xactions/browser-scripts/export-session-devtools.js in console
#    Downloads x-session.json

# 2. Copy to Fly.io VM:
fly ssh console
# then inside the VM:
cat > /app/config/x-session.json << 'EOF'
{paste JSON here}
EOF
```

**Refreshing session** (every 1-3 weeks when it expires):
Same process as above — re-export and re-upload.

**Redeploy after code changes:**
```bash
fly deploy
```

---

## Files to Create

- `paste-dashboard/Dockerfile`
- `paste-dashboard/fly.toml`
- `paste-dashboard/.dockerignore`
- `paste-dashboard/src/app/api/health/route.ts`
- `paste-dashboard/docs/DEPLOY.md`

## Files to Modify

- `paste-dashboard/next.config.ts` — add `output: 'standalone'`

---

## Done When

- `docker build -t paste-markets paste-dashboard/` completes successfully
- `fly deploy` from `paste-dashboard/` deploys the app
- Health check at `/api/health` returns 200
- SQLite data persists across redeploys via Fly volume
- DEPLOY.md clearly explains the session upload flow for someone doing it manually
