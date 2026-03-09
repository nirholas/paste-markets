# How it works

```
┌─ your agent ───────────────┐       ┌─ paste.trade ─────────────────┐
│  read source               │       │                                │
│      │                     │       │                                │
│      ▼              create │ |──>| │  source page goes live         │
│  enrich              meta  │ |──>| │  author, date, thumbnail fill  │
│  (speakers, publish date)  │ |   | │                                │
│      │                     │ |   | │                                │
│      ▼                     │ |   | │                                │
│  find trade ideas    save  │ |──>| │  thesis cards appear           │
│      │                     │ |   | │  (candidates visible)          │
│   ┌──┼──┐                  │ |   | │                                │
│   ▼  ▼  ▼  research each,  │ |   | │                                │
│  [1][2][3] compare, pick   │ |──>| │  cards resolve one by one      │
│   └──┼──┘  best instrument │ |   | │  (explanation + price appear)  │
│      │                     │ |   | │                                │
│      ▼              post   │ |──>| │  trades live on profile        │
│                            │ |   | │  publish price locked          │
└────────────────────────────┘       └────────────────────────────────┘
```

## Steps

| Step | Agent | paste.trade |
|------|-------|-------------|
| 1. Classify | Decide if input is URL or typed text | |
| 2. Extract + create | Pull text from URL, create source page | Source page streams progress |
| 3. Enrich | Figure out who's talking, find date | Header fills in (avatar, date) |
| 4. Extract theses | 3-pass: beliefs → ideas → save | Thesis cards appear with candidates |
| 5a. Research | Web search, find instruments, pull source context | |
| 5b. Narrate | Write explanation, build comparison table | Cards resolve with explanation |
| 5c. Price + save | Check price, persist route + derivation | Price appears on card |
| 6. Post + finalize | Publish each trade, close the source | Trades live on profile |

## Five API arrows

- **create** — source page goes live immediately. User gets a link to watch progress.
- **meta** — enriched metadata (author, date, thumbnail) pushed to source page during step 3.
- **save** — each thesis saved as unrouted with candidates. Cards appear on source page.
- **route** — each thesis routed with explanation + price. Cards resolve one by one.
- **post** — each trade posted with `publish_price` locked. P&L tracked from that moment against live prices.

## Key concepts

- **publish_price** — price when the source author published. Measures author timing.
- **created_at_price** — price when trade was posted to paste.trade. Measures paste.trade timing.
- **Comparison table** — when routing, agent evaluates multiple candidate tickers side by side (case + catalyst) and picks the best fit.
- **Derivation display** — three rendering modes by priority: explanation → comparison table → step chain.

## Streaming

Every tool call emits events to the source page via WebSocket. The LLM never decides to emit events — tools do it automatically.

**Thesis lifecycle:** `saved → routing → routed | dropped → posted`

Each thesis card on the source page follows this state machine. Cards appear as unrouted candidates (step 4), resolve independently as routing completes (step 5), and finalize when posted (step 6).

**Event types:**
- `started`, `extracted`, `enriching` — phase progress
- `source_updated` — metadata push (author, date, thumbnail)
- `thesis_saved`, `thesis_routing`, `thesis_routed`, `thesis_dropped` — per-thesis lifecycle
- `trade_posted` — trade is live
- `done`, `error` — terminal states

---

## Field glossary

The skill uses two main data shapes. Here's what each field means in plain English.

### Thesis (created in step 4)

| Field | What it means |
|-------|--------------|
| `thesis` | The tradeable idea, in one sentence |
| `horizon` | How long until this plays out ("by Q3", "next 12 months") |
| `route_status` | Has the AI found a way to trade this? `unrouted` = not yet, `routed` = yes |
| `unrouted_reason` | Why not, if it hasn't been routed yet |
| `who` | Which tickers or instruments could express this trade. Starts as ideas, gets overwritten with the final pick during routing |
| `why` | The reasoning chain — author's logic + the AI's own research |
| `quotes` | Exact words from the source that back this thesis |
| `headline_quote` | The one quote that goes on the trade card. Chosen during extraction, never rewritten after |
| `source_date` | When the original source was published |

### Route evidence (created in step 5)

| Field | What it means |
|-------|--------------|
| `subjects` | The real-world things being traded (e.g., "NuScale Power", "US small caps") |
| `direct_checks` | "I checked if you can actually trade this ticker — here's what I found" |
| `selected_expression` | The final pick: which ticker, on which platform, at what price |
| `ticker` | The stock/crypto symbol (e.g., NVDA, SMR, IWM) |
| `direction` | `long` (betting it goes up) or `short` (betting it goes down) |
| `instrument` | `shares` (stocks on Robinhood) or `perps` (perpetual futures on Hyperliquid) |
| `platform` | Where to execute: `robinhood` or `hyperliquid` |
| `trade_type` | `direct` (the author basically named it) or `derived` (the AI connected the dots) |
| `publish_price` | Price when the source was published — this is the "entry" price on the card |
| `source_date_price` | Same as publish_price (historical name) |
| `since_published_move_pct` | How much the price has moved since the source was published |
| `fallback_reason_tag` | If the AI picked a proxy ticker instead of the obvious one, why |

### Derivation (the trade explanation, created in step 5b)

| Field | What it means |
|-------|--------------|
| `explanation` | The main write-up that appears on the trade card. The sharp insight, not a generic summary |
| `comparison` | Side-by-side evaluation of candidate tickers (question + candidates + reasoning) |
| `candidates` | Each ticker considered, with `case` (why it fits or doesn't) and `catalyst` (upcoming event + date) |
| `segments` | Source quotes that anchor this trade, with speaker attribution |
| `steps` | The reasoning chain from quote → thesis → instrument. Provenance metadata |
