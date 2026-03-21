# Deployment Runbook — paste-markets on Fly.io

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated (`fly auth login`)
- Docker installed locally (for testing builds)
- Access to `PASTE_TRADE_KEY` and `ANTHROPIC_API_KEY`

---

## First Deploy

```bash
cd paste-dashboard

# 1. Create the Fly app (links fly.toml to a real app)
fly launch --no-deploy

# 2. Create persistent volumes
fly volumes create data   --size 1 --region ord
fly volumes create config --size 1 --region ord

# 3. Set secrets (never stored in fly.toml or git)
fly secrets set \
  PASTE_TRADE_KEY=your_paste_trade_key_here \
  ANTHROPIC_API_KEY=your_anthropic_key_here \
  NEXT_PUBLIC_BASE_URL=https://paste-markets.fly.dev

# 4. Deploy
fly deploy
```

After deploy, verify the health check:

```bash
curl https://paste-markets.fly.dev/api/health
# → {"ok":true,"timestamp":"2026-..."}
```

---

## Uploading the X Session Cookie

The Playwright tweet scraper requires a valid X (Twitter) session stored at `/app/config/x-session.json` on the VM. This file is **never committed to git** and must be uploaded manually after each deploy or when the session expires.

### Step 1 — Export the session from your browser

1. Open [x.com](https://x.com) in Chrome and log in to the account you want to scrape as.
2. Open DevTools (`F12`), go to the **Console** tab.
3. Paste and run the export script:

```js
// xactions/browser-scripts/export-session-devtools.js
// (paste the full contents of that file here)
```

This downloads `x-session.json` to your computer.

### Step 2 — Copy the session file to the Fly.io VM

```bash
# SSH into the running VM
fly ssh console

# Inside the VM, write the session file
# (paste your JSON content between the EOF markers)
cat > /app/config/x-session.json << 'EOF'
{
  "cookies": [ ... paste JSON here ... ]
}
EOF

# Verify it was written
ls -la /app/config/x-session.json
```

The session is now live. No redeploy needed — the scraper reads the file at runtime.

### Refreshing the Session (every 1–3 weeks)

X sessions expire. When scraping starts returning auth errors, repeat Step 1 and Step 2 above with a freshly exported cookie file.

---

## Redeploy After Code Changes

```bash
cd paste-dashboard
fly deploy
```

Fly.io performs a rolling deploy — the old machine stays up until the new one passes health checks, so there is no downtime. The `/app/data` and `/app/config` volumes persist across redeploys.

---

## Checking Logs

```bash
# Stream live logs
fly logs

# Last 100 lines
fly logs --no-tail | head -100
```

---

## Scaling

The default config runs 1 `shared-cpu-1x` machine with 512 MB RAM. Chromium requires at least 256 MB; 512 MB gives headroom for concurrent scans.

To scale up:

```bash
# Increase RAM on the existing machine size
fly scale memory 1024

# Or switch to a dedicated CPU
fly scale vm shared-cpu-2x
```

---

## SQLite Data

SQLite lives at `/app/data/paste-markets.sqlite` on the persistent volume. To inspect it:

```bash
fly ssh console
sqlite3 /app/data/paste-markets.sqlite
```

To back it up locally:

```bash
fly sftp get /app/data/paste-markets.sqlite ./backup.sqlite
```
