-- Tracked authors
CREATE TABLE IF NOT EXISTS authors (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  added_at TEXT DEFAULT (datetime('now')),
  last_fetched TEXT,
  total_trades INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  avg_pnl REAL DEFAULT 0,
  best_pnl REAL,
  worst_pnl REAL,
  best_ticker TEXT,
  worst_ticker TEXT,
  rank INTEGER
);

-- Individual trades (cached from paste.trade)
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_handle TEXT NOT NULL,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  pnl_pct REAL,
  platform TEXT,
  entry_date TEXT,
  posted_at TEXT,
  source_url TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  -- Timestamp integrity fields
  tweet_id TEXT,
  tweet_created_at TEXT,        -- when the tweet was posted (author_date from paste.trade)
  submitted_at TEXT,            -- when submitted to paste.trade (posted_at from paste.trade)
  delay_minutes INTEGER DEFAULT 0,
  integrity TEXT DEFAULT 'unknown', -- live | late | historical | retroactive | unknown
  counted_in_stats INTEGER DEFAULT 1, -- 0 for retroactive calls
  price_at_tweet_time REAL,     -- entry price at tweet time
  price_at_submission REAL,     -- entry price at submission time
  tweet_deleted_at TEXT,        -- set if tweet is detected as deleted
  tweet_content_hash TEXT,      -- sha256 of tweet text at submission time
  FOREIGN KEY (author_handle) REFERENCES authors(handle),
  UNIQUE(author_handle, ticker, direction, entry_date)
);

-- Precomputed rankings snapshot
CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_handle TEXT NOT NULL,
  rank INTEGER NOT NULL,
  win_rate REAL,
  avg_pnl REAL,
  total_trades INTEGER,
  computed_at TEXT DEFAULT (datetime('now')),
  timeframe TEXT DEFAULT '30d',
  FOREIGN KEY (author_handle) REFERENCES authors(handle)
);

-- Search/view tracking (for trending)
CREATE TABLE IF NOT EXISTS views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_handle TEXT NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  page TEXT -- 'profile', 'leaderboard', 'h2h', 'wrapped'
);

CREATE INDEX IF NOT EXISTS idx_trades_author ON trades(author_handle);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_rankings_timeframe ON rankings(timeframe, rank);
CREATE INDEX IF NOT EXISTS idx_views_handle ON views(author_handle);

-- Bulk caller scan jobs
CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  tweets_scanned INTEGER DEFAULT 0,
  calls_found INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_handle ON scan_jobs(handle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);

-- Scan rate limiting (one row per request attempt)
CREATE TABLE IF NOT EXISTS scan_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_rate_ip ON scan_rate_limits(ip, created_at);

-- ─── Wagering ─────────────────────────────────────────────────────────────────

-- Per-call wager configuration (keyed by paste.trade item ID)
CREATE TABLE IF NOT EXISTS trade_wager_config (
  trade_card_id     TEXT PRIMARY KEY,
  author_handle     TEXT NOT NULL,
  ticker            TEXT NOT NULL,
  direction         TEXT NOT NULL,
  entry_price       REAL,
  wager_deadline    TEXT NOT NULL,
  settlement_date   TEXT NOT NULL,
  caller_tip_bps    INTEGER NOT NULL DEFAULT 1000,
  total_wagered     REAL NOT NULL DEFAULT 0,
  wager_count       INTEGER NOT NULL DEFAULT 0,
  wager_vault_address TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  settled_at        TEXT,
  caller_tip_earned REAL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Individual wagers on a call
CREATE TABLE IF NOT EXISTS wagers (
  id              TEXT PRIMARY KEY,
  trade_card_id   TEXT NOT NULL,
  wallet_address  TEXT NOT NULL,
  handle          TEXT,
  amount          REAL NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USDC',
  status          TEXT NOT NULL DEFAULT 'active',
  wagered_at      TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at      TEXT,
  pnl_amount      REAL,
  tx_signature    TEXT NOT NULL,
  FOREIGN KEY (trade_card_id) REFERENCES trade_wager_config(trade_card_id),
  UNIQUE (trade_card_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_wagers_trade ON wagers(trade_card_id);
CREATE INDEX IF NOT EXISTS idx_wagers_wallet ON wagers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_twc_author ON trade_wager_config(author_handle);

-- ─── Public API keys ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  key         TEXT PRIMARY KEY,
  handle      TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'free', -- free | developer
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_used   TEXT,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_api_keys_handle ON api_keys(handle);
