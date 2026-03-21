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
  prev_rank INTEGER,
  win_rate REAL,
  avg_pnl REAL,
  total_trades INTEGER,
  total_pnl REAL,
  streak INTEGER DEFAULT 0,
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

-- ─── Social Proof Wall ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wall_posts (
  id TEXT PRIMARY KEY,
  author_handle TEXT NOT NULL,
  author_display_name TEXT,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  tweet_url TEXT,
  posted_at TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  category TEXT DEFAULT 'reaction', -- reaction, testimonial, feature_request
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wall_posts_category ON wall_posts(category);
CREATE INDEX IF NOT EXISTS idx_wall_posts_featured ON wall_posts(featured);
CREATE INDEX IF NOT EXISTS idx_wall_posts_posted_at ON wall_posts(posted_at DESC);

-- ─── Waitlist ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitter_handle TEXT NOT NULL UNIQUE,
  email TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  position INTEGER,
  status TEXT DEFAULT 'waiting', -- waiting, invited, active
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_referral ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- ─── Price Alert Notifications ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_handle TEXT NOT NULL,
  alert_type TEXT NOT NULL,   -- 'caller', 'ticker', 'consensus'
  target TEXT NOT NULL,        -- handle or ticker symbol
  threshold_pnl REAL,         -- optional: only alert if P&L > X%
  channel TEXT DEFAULT 'web',  -- web, email, telegram, webhook
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_handle);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type, target);

-- ─── Caller Nominations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_handle TEXT NOT NULL,
  submitted_by TEXT,
  reason TEXT,
  example_tweet_url TEXT,
  upvotes INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, tracked
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_handle ON submissions(caller_handle);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_upvotes ON submissions(upvotes DESC);

-- ─── Telegram Bot Subscriptions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS telegram_subs (
  chat_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (chat_id, caller_handle)
);

CREATE INDEX IF NOT EXISTS idx_telegram_subs_handle ON telegram_subs(caller_handle);

-- ─── Caller Watchlist (real-time streaming) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS caller_watchlist (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  tier TEXT DEFAULT 'C',
  check_interval_ms INTEGER DEFAULT 1800000,
  last_checked_at TEXT,
  last_tweet_id TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_watchlist_enabled ON caller_watchlist(enabled);

-- Live signal detections from the poller
CREATE TABLE IF NOT EXISTS live_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL,
  tweet_id TEXT NOT NULL UNIQUE,
  tweet_text TEXT NOT NULL,
  tweet_url TEXT NOT NULL,
  tweet_date TEXT NOT NULL,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  platform TEXT,
  confidence REAL NOT NULL,
  entry_price REAL,
  trade_url TEXT,
  paste_trade_id TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  detection_latency_ms INTEGER,
  FOREIGN KEY (handle) REFERENCES caller_watchlist(handle)
);

CREATE INDEX IF NOT EXISTS idx_live_signals_handle ON live_signals(handle);
CREATE INDEX IF NOT EXISTS idx_live_signals_detected ON live_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_signals_confidence ON live_signals(confidence DESC);

-- ─── Backtest Jobs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backtest_jobs (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT DEFAULT 'fetching_tweets',
  tweets_scanned INTEGER DEFAULT 0,
  total_tweets INTEGER DEFAULT 0,
  calls_found INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_backtest_jobs_handle ON backtest_jobs(handle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_jobs_status ON backtest_jobs(status);

-- ─── Wager Events (social feed) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wager_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- 'new_wager' | 'settled' | 'tip_earned'
  trade_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  backer_handle TEXT,
  amount REAL,
  pnl_percent REAL,
  tip_amount REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wager_events_trade ON wager_events(trade_id);
CREATE INDEX IF NOT EXISTS idx_wager_events_type ON wager_events(type);
CREATE INDEX IF NOT EXISTS idx_wager_events_created ON wager_events(created_at DESC);

-- ─── Event Markets (Polymarket sports/event betting) ─────────────────────────

CREATE TABLE IF NOT EXISTS event_markets (
  id TEXT PRIMARY KEY,
  polymarket_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'sports' | 'politics' | 'crypto' | 'entertainment' | 'science' | 'economics'
  subcategory TEXT,                -- 'NBA' | 'NFL' | 'UFC' | etc.
  description TEXT,
  current_probability REAL,
  probability_24h_ago REAL,
  volume REAL DEFAULT 0,
  settlement_date TEXT,
  settled INTEGER DEFAULT 0,
  outcome TEXT,                    -- 'YES' | 'NO' | null
  caller_count INTEGER DEFAULT 0,
  market_url TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_markets_category ON event_markets(category);
CREATE INDEX IF NOT EXISTS idx_event_markets_subcategory ON event_markets(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_event_markets_settlement ON event_markets(settlement_date);
CREATE INDEX IF NOT EXISTS idx_event_markets_settled ON event_markets(settled);

-- Caller positions on event markets
CREATE TABLE IF NOT EXISTS event_market_calls (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  direction TEXT NOT NULL,         -- 'yes' | 'no'
  entry_probability REAL NOT NULL,
  called_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (market_id) REFERENCES event_markets(id),
  UNIQUE(market_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_event_calls_market ON event_market_calls(market_id);
CREATE INDEX IF NOT EXISTS idx_event_calls_handle ON event_market_calls(handle);

-- ─── Source Extractions (What's The Trade? multi-thesis) ────────────────────

-- Each extraction run (one URL or text input → multiple theses)
CREATE TABLE IF NOT EXISTS source_extractions (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,          -- tweet | thread | article | youtube | pdf | text
  source_url TEXT,
  title TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  thesis_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_source_extractions_created ON source_extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_extractions_type ON source_extractions(source_type);

-- Individual theses extracted from a source
CREATE TABLE IF NOT EXISTS extracted_theses (
  id TEXT PRIMARY KEY,
  extraction_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,            -- long | short | yes | no
  platform TEXT NOT NULL,             -- hyperliquid | robinhood | polymarket
  confidence INTEGER DEFAULT 50,
  reasoning TEXT,
  quote TEXT,
  timeframe TEXT,
  conviction TEXT DEFAULT 'medium',   -- high | medium | low
  price_at_extraction REAL,
  paste_trade_id TEXT,
  paste_trade_url TEXT,
  current_pnl REAL,
  tracked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (extraction_id) REFERENCES source_extractions(id)
);

CREATE INDEX IF NOT EXISTS idx_extracted_theses_extraction ON extracted_theses(extraction_id);
CREATE INDEX IF NOT EXISTS idx_extracted_theses_ticker ON extracted_theses(ticker);

-- ─── Copytrading Alert Rules ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL,          -- JSON array of AlertCondition
  channels TEXT NOT NULL,            -- JSON array of AlertChannel
  enabled INTEGER DEFAULT 1,
  match_count INTEGER DEFAULT 0,
  last_matched_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

CREATE TABLE IF NOT EXISTS alert_notifications (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  trade_id TEXT,
  caller_handle TEXT,
  ticker TEXT,
  direction TEXT,
  message TEXT NOT NULL,
  channel TEXT NOT NULL,             -- 'browser' | 'telegram' | 'webhook'
  delivered INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_rule ON alert_notifications(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_unread ON alert_notifications(delivered, read_at);
