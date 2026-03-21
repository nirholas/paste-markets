-- paste-dashboard Postgres schema (Neon)
-- Converted from SQLite. Uses standard Postgres types and functions.

-- Tracked authors
CREATE TABLE IF NOT EXISTS authors (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched TIMESTAMPTZ,
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
  id SERIAL PRIMARY KEY,
  author_handle TEXT NOT NULL REFERENCES authors(handle),
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  pnl_pct REAL,
  platform TEXT,
  entry_date TEXT,
  posted_at TEXT,
  source_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  tweet_id TEXT,
  tweet_created_at TEXT,
  submitted_at TEXT,
  delay_minutes INTEGER DEFAULT 0,
  integrity TEXT DEFAULT 'unknown',
  counted_in_stats INTEGER DEFAULT 1,
  price_at_tweet_time REAL,
  price_at_submission REAL,
  tweet_deleted_at TEXT,
  tweet_content_hash TEXT,
  UNIQUE(author_handle, ticker, direction, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_trades_author ON trades(author_handle);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);

-- Precomputed rankings snapshot
CREATE TABLE IF NOT EXISTS rankings (
  id SERIAL PRIMARY KEY,
  author_handle TEXT NOT NULL REFERENCES authors(handle),
  rank INTEGER NOT NULL,
  prev_rank INTEGER,
  win_rate REAL,
  avg_pnl REAL,
  total_trades INTEGER,
  total_pnl REAL,
  streak INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  timeframe TEXT DEFAULT '30d'
);

CREATE INDEX IF NOT EXISTS idx_rankings_timeframe ON rankings(timeframe, rank);

-- Search/view tracking (for trending)
CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  author_handle TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  page TEXT
);

CREATE INDEX IF NOT EXISTS idx_views_handle ON views(author_handle);

-- Bulk caller scan jobs
CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  tweets_scanned INTEGER DEFAULT 0,
  calls_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_handle ON scan_jobs(handle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);

-- Scan rate limiting
CREATE TABLE IF NOT EXISTS scan_rate_limits (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_rate_ip ON scan_rate_limits(ip, created_at);

-- Wagering
CREATE TABLE IF NOT EXISTS trade_wager_config (
  trade_card_id TEXT PRIMARY KEY,
  author_handle TEXT NOT NULL,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price REAL,
  wager_deadline TEXT NOT NULL,
  settlement_date TEXT NOT NULL,
  caller_tip_bps INTEGER NOT NULL DEFAULT 1000,
  total_wagered REAL NOT NULL DEFAULT 0,
  wager_count INTEGER NOT NULL DEFAULT 0,
  wager_vault_address TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  settled_at TEXT,
  caller_tip_earned REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wagers (
  id TEXT PRIMARY KEY,
  trade_card_id TEXT NOT NULL REFERENCES trade_wager_config(trade_card_id),
  wallet_address TEXT NOT NULL,
  handle TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'active',
  wagered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TEXT,
  pnl_amount REAL,
  tx_signature TEXT NOT NULL,
  display_on_feed INTEGER DEFAULT 1,
  backer_handle TEXT,
  backer_avatar_url TEXT,
  UNIQUE (trade_card_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_wagers_trade ON wagers(trade_card_id);
CREATE INDEX IF NOT EXISTS idx_wagers_wallet ON wagers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_twc_author ON trade_wager_config(author_handle);

-- Public API keys
CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_api_keys_handle ON api_keys(handle);

-- Social Proof Wall
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
  category TEXT DEFAULT 'reaction',
  featured INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wall_posts_category ON wall_posts(category);
CREATE INDEX IF NOT EXISTS idx_wall_posts_featured ON wall_posts(featured);
CREATE INDEX IF NOT EXISTS idx_wall_posts_posted_at ON wall_posts(posted_at DESC);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  twitter_handle TEXT NOT NULL UNIQUE,
  email TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  position INTEGER,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_referral ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- Price Alert Notifications
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_handle TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  target TEXT NOT NULL,
  threshold_pnl REAL,
  channel TEXT DEFAULT 'web',
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_handle);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type, target);

-- Caller Nominations
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  caller_handle TEXT NOT NULL,
  submitted_by TEXT,
  reason TEXT,
  example_tweet_url TEXT,
  upvotes INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_handle ON submissions(caller_handle);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_upvotes ON submissions(upvotes DESC);

-- Telegram Bot Subscriptions
CREATE TABLE IF NOT EXISTS telegram_subs (
  chat_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, caller_handle)
);

CREATE INDEX IF NOT EXISTS idx_telegram_subs_handle ON telegram_subs(caller_handle);

-- Caller Watchlist
CREATE TABLE IF NOT EXISTS caller_watchlist (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  tier TEXT DEFAULT 'C',
  check_interval_ms INTEGER DEFAULT 1800000,
  last_checked_at TEXT,
  last_tweet_id TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_enabled ON caller_watchlist(enabled);

CREATE TABLE IF NOT EXISTS live_signals (
  id SERIAL PRIMARY KEY,
  handle TEXT NOT NULL REFERENCES caller_watchlist(handle),
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
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  detection_latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_live_signals_handle ON live_signals(handle);
CREATE INDEX IF NOT EXISTS idx_live_signals_detected ON live_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_signals_confidence ON live_signals(confidence DESC);

-- Backtest Jobs
CREATE TABLE IF NOT EXISTS backtest_jobs (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT DEFAULT 'fetching_tweets',
  tweets_scanned INTEGER DEFAULT 0,
  total_tweets INTEGER DEFAULT 0,
  calls_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_backtest_jobs_handle ON backtest_jobs(handle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_jobs_status ON backtest_jobs(status);

-- Wager Events
CREATE TABLE IF NOT EXISTS wager_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  trade_id TEXT NOT NULL,
  caller_handle TEXT NOT NULL,
  backer_handle TEXT,
  amount REAL,
  pnl_percent REAL,
  tip_amount REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wager_events_trade ON wager_events(trade_id);
CREATE INDEX IF NOT EXISTS idx_wager_events_type ON wager_events(type);
CREATE INDEX IF NOT EXISTS idx_wager_events_created ON wager_events(created_at DESC);

-- Event Markets
CREATE TABLE IF NOT EXISTS event_markets (
  id TEXT PRIMARY KEY,
  polymarket_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  current_probability REAL,
  probability_24h_ago REAL,
  volume REAL DEFAULT 0,
  settlement_date TEXT,
  settled INTEGER DEFAULT 0,
  outcome TEXT,
  caller_count INTEGER DEFAULT 0,
  market_url TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_markets_category ON event_markets(category);
CREATE INDEX IF NOT EXISTS idx_event_markets_subcategory ON event_markets(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_event_markets_settlement ON event_markets(settlement_date);
CREATE INDEX IF NOT EXISTS idx_event_markets_settled ON event_markets(settled);

CREATE TABLE IF NOT EXISTS event_market_calls (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES event_markets(id),
  handle TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_probability REAL NOT NULL,
  called_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_event_calls_market ON event_market_calls(market_id);
CREATE INDEX IF NOT EXISTS idx_event_calls_handle ON event_market_calls(handle);

-- Source Extractions
CREATE TABLE IF NOT EXISTS source_extractions (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  thesis_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_extractions_created ON source_extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_extractions_type ON source_extractions(source_type);

CREATE TABLE IF NOT EXISTS extracted_theses (
  id TEXT PRIMARY KEY,
  extraction_id TEXT NOT NULL REFERENCES source_extractions(id),
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  platform TEXT NOT NULL,
  confidence INTEGER DEFAULT 50,
  reasoning TEXT,
  quote TEXT,
  timeframe TEXT,
  conviction TEXT DEFAULT 'medium',
  price_at_extraction REAL,
  paste_trade_id TEXT,
  paste_trade_url TEXT,
  current_pnl REAL,
  tracked_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_theses_extraction ON extracted_theses(extraction_id);
CREATE INDEX IF NOT EXISTS idx_extracted_theses_ticker ON extracted_theses(ticker);

-- Copytrading Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL,
  channels TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  match_count INTEGER DEFAULT 0,
  last_matched_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

CREATE TABLE IF NOT EXISTS alert_notifications (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES alert_rules(id),
  trade_id TEXT,
  caller_handle TEXT,
  ticker TEXT,
  direction TEXT,
  message TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivered INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_rule ON alert_notifications(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_unread ON alert_notifications(delivered, read_at);

-- Executed Trades (trade execution tracking)
CREATE TABLE IF NOT EXISTS executed_trades (
  id TEXT PRIMARY KEY,
  trade_id TEXT,
  wallet_address TEXT NOT NULL,
  venue TEXT NOT NULL,
  asset TEXT NOT NULL,
  direction TEXT NOT NULL,
  order_type TEXT DEFAULT 'market',
  size_usd REAL NOT NULL,
  leverage REAL DEFAULT 1,
  entry_price REAL,
  stop_loss REAL,
  take_profit REAL,
  status TEXT DEFAULT 'pending',
  fill_price REAL,
  fill_size REAL,
  fees REAL,
  tx_hash TEXT,
  venue_order_id TEXT,
  closed_at TEXT,
  close_price REAL,
  realized_pnl REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executed_trades_wallet ON executed_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_executed_trades_status ON executed_trades(status);
CREATE INDEX IF NOT EXISTS idx_executed_trades_trade ON executed_trades(trade_id);
