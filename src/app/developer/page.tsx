import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer API — paste.trade",
  description: "Public REST API for paste.trade data. Query trades, callers, assets, and leaderboards.",
  openGraph: {
    title: "paste.trade Developer API",
    description: "Build on top of real crypto trade call data.",
  },
};

export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-[#c8c8d0] font-mono">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-10 flex gap-8">
        <Sidebar />
        <main className="flex-1 min-w-0 space-y-16">
          <Overview />
          <Authentication />
          <RateLimits />
          <ResponseFormat />
          <EndpointsTrades />
          <EndpointsCallers />
          <EndpointsAssets />
          <EndpointsLeaderboard />
          <KeyGeneration />
          <CodeExamples />
          <ErrorCodes />
        </main>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[#1a1a2e] bg-[#0f0f22] px-4 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-[#f0f0f0] font-bold text-lg hover:text-[#3b82f6] transition-colors">
            paste.trade
          </a>
          <span className="text-[#555568]">/</span>
          <span className="text-[#f0f0f0] font-bold">Developer API</span>
          <span className="text-xs border border-[#3b82f6] text-[#3b82f6] px-2 py-0.5 rounded">v1</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a href="/leaderboard" className="text-[#555568] hover:text-[#c8c8d0] transition-colors">Leaderboard</a>
          <a href="/callers" className="text-[#555568] hover:text-[#c8c8d0] transition-colors">Callers</a>
          <a
            href="#get-key"
            className="border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white px-3 py-1 rounded transition-colors"
          >
            Get API Key
          </a>
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const sections = [
    { id: "overview", label: "Overview" },
    { id: "authentication", label: "Authentication" },
    { id: "rate-limits", label: "Rate Limits" },
    { id: "response-format", label: "Response Format" },
    { id: "trades", label: "Trades" },
    { id: "callers", label: "Callers" },
    { id: "assets", label: "Assets" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "get-key", label: "Get API Key" },
    { id: "examples", label: "Code Examples" },
    { id: "errors", label: "Error Codes" },
  ];

  return (
    <nav className="hidden lg:block w-48 flex-shrink-0 sticky top-6 self-start">
      <ul className="space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="block text-[13px] text-[#555568] hover:text-[#c8c8d0] py-1 transition-colors"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---- Section components ----

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[#f0f0f0] text-xl font-bold mb-4 border-b border-[#1a1a2e] pb-2">
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[#f0f0f0] font-bold text-base mb-2 mt-6">{children}</h3>;
}

function Code({ children, lang = "text" }: { children: string; lang?: string }) {
  return (
    <pre className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm text-[#c8c8d0] leading-relaxed">
      <code data-lang={lang}>{children.trim()}</code>
    </pre>
  );
}

function Param({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-2 border-b border-[#1a1a2e] last:border-0">
      <div className="w-40 flex-shrink-0">
        <span className="text-[#3b82f6] text-sm">{name}</span>
        {required && <span className="text-[#e74c3c] text-xs ml-1">*</span>}
        <div className="text-[#555568] text-xs">{type}</div>
      </div>
      <div className="text-sm text-[#c8c8d0]">{children}</div>
    </div>
  );
}

function EndpointBadge({ method, path }: { method: string; path: string }) {
  const color = method === "GET" ? "text-[#2ecc71] border-[#2ecc71]" : "text-[#f39c12] border-[#f39c12]";
  return (
    <div className="flex items-center gap-3 bg-[#0f0f22] border border-[#1a1a2e] rounded-lg px-4 py-3 mb-4">
      <span className={`text-xs font-bold border rounded px-2 py-0.5 ${color}`}>{method}</span>
      <span className="text-[#f0f0f0] font-mono text-sm">{path}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0f0f22] border-l-2 border-[#3b82f6] pl-4 py-2 text-sm text-[#c8c8d0] my-4">
      {children}
    </div>
  );
}

// ---- Sections ----

function Overview() {
  return (
    <section id="overview">
      <SectionTitle id="overview">Overview</SectionTitle>
      <p className="text-sm leading-relaxed mb-4">
        The paste.trade public API lets you programmatically access trade calls, caller profiles,
        asset data, and leaderboard rankings. Built for developers who want to build bots, analytics
        tools, or integrations on top of verified CT trade data.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
          <div className="text-[#555568] text-xs uppercase tracking-widest mb-1">Base URL</div>
          <div className="text-[#f0f0f0] text-sm font-mono">https://paste.trade/v1</div>
        </div>
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
          <div className="text-[#555568] text-xs uppercase tracking-widest mb-1">Version</div>
          <div className="text-[#f0f0f0] text-sm font-mono">v1</div>
        </div>
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
          <div className="text-[#555568] text-xs uppercase tracking-widest mb-1">Format</div>
          <div className="text-[#f0f0f0] text-sm font-mono">JSON</div>
        </div>
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
          <div className="text-[#555568] text-xs uppercase tracking-widest mb-1">Auth</div>
          <div className="text-[#f0f0f0] text-sm font-mono">Bearer token</div>
        </div>
      </div>
    </section>
  );
}

function Authentication() {
  return (
    <section id="authentication">
      <SectionTitle id="authentication">Authentication</SectionTitle>
      <p className="text-sm mb-4">
        Pass your API key via the <code className="text-[#3b82f6]">Authorization</code> header or{" "}
        <code className="text-[#3b82f6]">api_key</code> query parameter.
      </p>

      <SubTitle>Header (recommended)</SubTitle>
      <Code lang="http">{`GET /v1/trades HTTP/1.1
Host: paste.trade
Authorization: Bearer pt_your_key_here`}</Code>

      <SubTitle>Query parameter</SubTitle>
      <Code lang="http">{`GET /v1/trades?api_key=pt_your_key_here`}</Code>

      <Note>
        Without an API key, requests are limited to 60/hour per IP. Create a free key below to get
        100 requests/day.
      </Note>

      <SubTitle>Tiers</SubTitle>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden text-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0f0f22] text-[#555568] text-xs uppercase tracking-widest">
              <th className="text-left px-4 py-3">Tier</th>
              <th className="text-left px-4 py-3">Limit</th>
              <th className="text-left px-4 py-3">Window</th>
              <th className="text-left px-4 py-3">How to get</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#1a1a2e]">
              <td className="px-4 py-3 text-[#555568]">Anonymous</td>
              <td className="px-4 py-3">60 requests</td>
              <td className="px-4 py-3">per hour</td>
              <td className="px-4 py-3 text-[#555568]">No key needed</td>
            </tr>
            <tr className="border-t border-[#1a1a2e]">
              <td className="px-4 py-3 text-[#2ecc71]">Free</td>
              <td className="px-4 py-3">100 requests</td>
              <td className="px-4 py-3">per day</td>
              <td className="px-4 py-3">
                <a href="#get-key" className="text-[#3b82f6] hover:underline">Generate below</a>
              </td>
            </tr>
            <tr className="border-t border-[#1a1a2e]">
              <td className="px-4 py-3 text-[#f39c12]">Developer</td>
              <td className="px-4 py-3">10,000 requests</td>
              <td className="px-4 py-3">per day</td>
              <td className="px-4 py-3 text-[#555568]">Apply via Discord</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RateLimits() {
  return (
    <section id="rate-limits">
      <SectionTitle id="rate-limits">Rate Limits</SectionTitle>
      <p className="text-sm mb-4">
        Every response includes rate limit headers so you can track your usage.
      </p>
      <Code lang="http">{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711065600`}</Code>
      <p className="text-sm mt-4">
        When the limit is exceeded, the API returns a{" "}
        <code className="text-[#e74c3c]">429 Too Many Requests</code> response with a{" "}
        <code className="text-[#3b82f6]">Retry-After</code> header.
      </p>
      <Code lang="json">{`{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Retry after 2026-03-22T00:00:00.000Z."
  },
  "requestId": "d4e5f6..."
}`}</Code>
    </section>
  );
}

function ResponseFormat() {
  return (
    <section id="response-format">
      <SectionTitle id="response-format">Response Format</SectionTitle>
      <p className="text-sm mb-4">All endpoints return a consistent envelope:</p>

      <SubTitle>Success</SubTitle>
      <Code lang="json">{`{
  "ok": true,
  "data": [...],          // the payload
  "meta": {
    "total": 1243,        // total matching records
    "limit": 20,          // page size
    "offset": 0,          // current offset
    "page": 1             // current page
  },
  "requestId": "abc123"   // for debugging
}`}</Code>

      <SubTitle>Error</SubTitle>
      <Code lang="json">{`{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Trade with ID \"999\" not found."
  },
  "requestId": "abc123"
}`}</Code>
    </section>
  );
}

function EndpointsTrades() {
  return (
    <section id="trades">
      <SectionTitle id="trades">Trades</SectionTitle>

      {/* GET /v1/trades */}
      <EndpointBadge method="GET" path="/v1/trades" />
      <p className="text-sm mb-4">List and search trades with flexible filtering.</p>
      <SubTitle>Query Parameters</SubTitle>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden mb-4">
        <Param name="ticker" type="string">Filter by asset ticker. Example: <code className="text-[#3b82f6]">BTC</code>, <code className="text-[#3b82f6]">ETH</code></Param>
        <Param name="author" type="string">Filter by caller handle (without @).</Param>
        <Param name="direction" type="enum">{"long | short | yes | no"}</Param>
        <Param name="platform" type="enum">{"hyperliquid | robinhood | polymarket"}</Param>
        <Param name="timeframe" type="enum">{"today | week | month | alltime"} — default: <code className="text-[#3b82f6]">week</code></Param>
        <Param name="sort" type="enum">{"pnl | date | confidence"} — default: <code className="text-[#3b82f6]">date</code></Param>
        <Param name="order" type="enum">{"asc | desc"} — default: <code className="text-[#3b82f6]">desc</code></Param>
        <Param name="min_pnl" type="number">Minimum PnL %. Use <code className="text-[#3b82f6]">0</code> for winners only.</Param>
        <Param name="integrity" type="enum">{"live | same_day | historical | retroactive"}</Param>
        <Param name="limit" type="number">Max 100, default 20.</Param>
        <Param name="offset" type="number">Pagination offset. Default 0.</Param>
      </div>
      <Code lang="bash">{`curl https://paste.trade/v1/trades?ticker=BTC&timeframe=week&sort=pnl \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>

      {/* GET /v1/trades/top */}
      <SubTitle>GET /v1/trades/top</SubTitle>
      <EndpointBadge method="GET" path="/v1/trades/top" />
      <p className="text-sm mb-4">Top performing trades by PnL, sorted descending.</p>
      <Code lang="bash">{`curl "https://paste.trade/v1/trades/top?timeframe=month&limit=10" \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>

      {/* GET /v1/trades/:id */}
      <SubTitle>GET /v1/trades/[id]</SubTitle>
      <EndpointBadge method="GET" path="/v1/trades/{id}" />
      <p className="text-sm mb-4">Full detail for a single trade including derivation steps and price history.</p>
      <Code lang="bash">{`curl https://paste.trade/v1/trades/42 \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>
      <SubTitle>Response shape</SubTitle>
      <Code lang="json">{`{
  "ok": true,
  "data": {
    "id": "42",
    "ticker": "BTC",
    "direction": "long",
    "platform": "hyperliquid",
    "author": {
      "handle": "zacxbt",
      "displayName": "Zac",
      "avatarUrl": "https://...",
      "verified": false
    },
    "sourceDate": "2026-03-15T10:00:00Z",
    "publishedAt": "2026-03-15T10:04:12Z",
    "prices": {
      "atSource": 83200,
      "atPublish": 83450,
      "current": 85100,
      "pnlFromSource": 2.28,
      "pnlFromPublish": null
    },
    "derivation": {
      "steps": ["Whale spotted accumulating BTC", "Support held at $83k", "New ATH momentum"],
      "thesis": "Bitcoin breaking out with whale accumulation.",
      "quote": "Loading BTC here. $100k incoming."
    },
    "source": {
      "url": "https://twitter.com/zacxbt/status/...",
      "type": "twitter",
      "title": null
    },
    "integrity": "live",
    "cardUrl": "https://paste.trade/s/42",
    "shareImageUrl": "https://paste.trade/api/og/share/42"
  },
  "requestId": "abc123"
}`}</Code>
    </section>
  );
}

function EndpointsCallers() {
  return (
    <section id="callers">
      <SectionTitle id="callers">Callers</SectionTitle>

      <EndpointBadge method="GET" path="/v1/callers" />
      <p className="text-sm mb-4">List callers with stats, sortable and filterable.</p>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden mb-4">
        <Param name="sort" type="enum">{"win_rate | avg_pnl | total_pnl | most_active"} — default: <code className="text-[#3b82f6]">win_rate</code></Param>
        <Param name="platform" type="enum">{"hyperliquid | robinhood | polymarket | all"}</Param>
        <Param name="asset" type="string">Filter by best ticker (e.g. <code className="text-[#3b82f6]">BTC</code>).</Param>
        <Param name="timeframe" type="enum">{"7d | 30d | all"} — default: <code className="text-[#3b82f6]">30d</code></Param>
        <Param name="q" type="string">Search by handle substring.</Param>
        <Param name="limit" type="number">Max 100, default 50.</Param>
        <Param name="offset" type="number">Pagination offset.</Param>
      </div>
      <Code lang="bash">{`# Top BTC callers this week by win rate
curl "https://paste.trade/v1/callers?asset=BTC&sort=win_rate&timeframe=7d" \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>

      <SubTitle>GET /v1/callers/[handle]</SubTitle>
      <EndpointBadge method="GET" path="/v1/callers/{handle}" />
      <p className="text-sm mb-4">Full profile and aggregate stats for a single caller.</p>
      <Code lang="bash">{`curl https://paste.trade/v1/callers/zacxbt \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>

      <SubTitle>GET /v1/callers/[handle]/trades</SubTitle>
      <EndpointBadge method="GET" path="/v1/callers/{handle}/trades" />
      <p className="text-sm mb-4">All trades by a specific caller, with pagination.</p>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden mb-4">
        <Param name="timeframe" type="enum">{"7d | 30d | 90d | all"} — default: <code className="text-[#3b82f6]">30d</code></Param>
        <Param name="sort" type="enum">{"pnl | date"} — default: <code className="text-[#3b82f6]">date</code></Param>
        <Param name="platform" type="enum">{"hyperliquid | robinhood | polymarket"}</Param>
        <Param name="limit" type="number">Max 100, default 20.</Param>
        <Param name="offset" type="number">Pagination offset.</Param>
      </div>
      <Code lang="bash">{`curl "https://paste.trade/v1/callers/zacxbt/trades?timeframe=90d&sort=pnl" \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>
    </section>
  );
}

function EndpointsAssets() {
  return (
    <section id="assets">
      <SectionTitle id="assets">Assets</SectionTitle>

      <EndpointBadge method="GET" path="/v1/assets" />
      <p className="text-sm mb-4">All tracked tickers with call counts and sentiment stats.</p>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden mb-4">
        <Param name="sort" type="enum">{"calls | pnl | bullish"} — default: <code className="text-[#3b82f6]">calls</code></Param>
        <Param name="q" type="string">Search by ticker symbol.</Param>
        <Param name="limit" type="number">Max 200, default 50.</Param>
        <Param name="offset" type="number">Pagination offset.</Param>
      </div>
      <Code lang="bash">{`curl "https://paste.trade/v1/assets?sort=pnl&limit=20" \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>

      <SubTitle>GET /v1/assets/[ticker]</SubTitle>
      <EndpointBadge method="GET" path="/v1/assets/{ticker}" />
      <p className="text-sm mb-4">Stats and trade history for a specific asset.</p>
      <Code lang="bash">{`curl https://paste.trade/v1/assets/BTC \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>
      <Code lang="json">{`{
  "ok": true,
  "data": {
    "stats": {
      "ticker": "BTC",
      "callCount": 142,
      "avgPnl": 8.3,
      "bullCount": 117,
      "bearCount": 25,
      "bullRatio": 0.824,
      "lastCallAt": "2026-03-21T09:22:00Z"
    },
    "trades": [...]
  },
  "meta": { "total": 142, "limit": 50, "offset": 0, "page": 1 }
}`}</Code>
    </section>
  );
}

function EndpointsLeaderboard() {
  return (
    <section id="leaderboard">
      <SectionTitle id="leaderboard">Leaderboard</SectionTitle>
      <EndpointBadge method="GET" path="/v1/leaderboard" />
      <p className="text-sm mb-4">Ranked list of callers by performance.</p>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden mb-4">
        <Param name="timeframe" type="enum">{"7d | 30d | all"} — default: <code className="text-[#3b82f6]">30d</code></Param>
        <Param name="sort" type="enum">{"win_rate | avg_pnl"} — default: <code className="text-[#3b82f6]">win_rate</code></Param>
        <Param name="platform" type="enum">{"hyperliquid | robinhood | polymarket | all"}</Param>
        <Param name="limit" type="number">Max 100, default 50.</Param>
        <Param name="offset" type="number">Pagination offset.</Param>
      </div>
      <Code lang="bash">{`curl "https://paste.trade/v1/leaderboard?timeframe=7d&platform=hyperliquid" \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>
    </section>
  );
}

function KeyGeneration() {
  return (
    <section id="get-key">
      <SectionTitle id="get-key">Get API Key</SectionTitle>
      <p className="text-sm mb-4">
        Generate a free API key (100 requests/day). No OAuth required for the free tier.
      </p>
      <EndpointBadge method="POST" path="/v1/keys" />
      <SubTitle>Request</SubTitle>
      <Code lang="json">{`{
  "handle": "your_twitter_handle"
}`}</Code>
      <SubTitle>Response</SubTitle>
      <Code lang="json">{`{
  "ok": true,
  "data": {
    "key": "pt_a1b2c3d4e5f6...",
    "tier": "free",
    "handle": "your_twitter_handle",
    "createdAt": "2026-03-21T12:00:00.000Z",
    "limits": {
      "requestsPerDay": 100,
      "note": "For a Developer key (10k/day), apply via Discord."
    },
    "instructions": [
      "Add to requests via: Authorization: Bearer pt_a1b2c3d4e5f6..."
    ]
  }
}`}</Code>
      <Note>
        Store your key securely. It will not be shown again. For a Developer tier key (10,000
        req/day), join the Discord or email dev@paste.trade.
      </Note>
      <SubTitle>Try it now (curl)</SubTitle>
      <Code lang="bash">{`curl -X POST https://paste.trade/v1/keys \\
  -H "Content-Type: application/json" \\
  -d '{"handle": "your_handle"}'`}</Code>
    </section>
  );
}

function CodeExamples() {
  return (
    <section id="examples">
      <SectionTitle id="examples">Code Examples</SectionTitle>

      <SubTitle>JavaScript / TypeScript</SubTitle>
      <Code lang="typescript">{`// Get top BTC callers this week
const res = await fetch(
  'https://paste.trade/v1/callers?asset=BTC&sort=win_rate&timeframe=7d',
  { headers: { 'Authorization': 'Bearer pt_your_key_here' } }
);
const { data, meta } = await res.json();
console.log(\`\${meta.total} callers found\`);
console.log(data[0].handle, data[0].stats.winRate + '% win rate');`}</Code>

      <SubTitle>Python</SubTitle>
      <Code lang="python">{`import requests

headers = {"Authorization": "Bearer pt_your_key_here"}
base = "https://paste.trade/v1"

# Fetch leaderboard
r = requests.get(f"{base}/leaderboard?timeframe=30d&limit=10", headers=headers)
data = r.json()

for caller in data["data"]:
    print(f"#{caller['rank']} {caller['handle']:20s} {caller['stats']['winRate']}% win rate")`}</Code>

      <SubTitle>curl</SubTitle>
      <Code lang="bash">{`# Top trades by PnL this month
curl "https://paste.trade/v1/trades/top?timeframe=month&limit=5" \\
  -H "Authorization: Bearer pt_your_key_here" | jq '.data[].ticker'

# All ETH calls with positive PnL
curl "https://paste.trade/v1/trades?ticker=ETH&min_pnl=0&sort=pnl" \\
  -H "Authorization: Bearer pt_your_key_here"

# Caller profile
curl https://paste.trade/v1/callers/zacxbt \\
  -H "Authorization: Bearer pt_your_key_here"`}</Code>

      <SubTitle>Node.js bot example</SubTitle>
      <Code lang="typescript">{`// Monitor for new high-conviction calls
async function getHighConvictionCalls() {
  const res = await fetch(
    'https://paste.trade/v1/trades?timeframe=today&sort=confidence&min_pnl=10&limit=5',
    { headers: { Authorization: 'Bearer pt_your_key_here' } }
  );
  const { data } = await res.json();
  return data.filter((t) => t.integrity === 'live');
}

setInterval(async () => {
  const calls = await getHighConvictionCalls();
  for (const call of calls) {
    console.log(\`\${call.author.handle} → \${call.direction.toUpperCase()} \${call.ticker} (+\${call.pnlPct}%)\`);
  }
}, 60_000); // check every minute`}</Code>
    </section>
  );
}

function ErrorCodes() {
  const codes = [
    { code: "INVALID_KEY", status: 401, desc: "API key is missing or invalid." },
    { code: "RATE_LIMITED", status: 429, desc: "Request rate limit exceeded. Check Retry-After header." },
    { code: "NOT_FOUND", status: 404, desc: "The requested resource does not exist." },
    { code: "INVALID_PARAM", status: 400, desc: "A query parameter has an invalid value." },
    { code: "INVALID_BODY", status: 400, desc: "Request body is missing or malformed JSON." },
    { code: "UPSTREAM_ERROR", status: 502, desc: "Upstream data source is temporarily unavailable." },
    { code: "SERVER_ERROR", status: 500, desc: "Unexpected internal error." },
    { code: "METHOD_NOT_ALLOWED", status: 405, desc: "HTTP method not supported on this endpoint." },
  ];

  return (
    <section id="errors">
      <SectionTitle id="errors">Error Codes</SectionTitle>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden text-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0f0f22] text-[#555568] text-xs uppercase tracking-widest">
              <th className="text-left px-4 py-3">code</th>
              <th className="text-left px-4 py-3">HTTP</th>
              <th className="text-left px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code} className="border-t border-[#1a1a2e]">
                <td className="px-4 py-3 text-[#e74c3c] font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3 text-[#555568]">{c.status}</td>
                <td className="px-4 py-3">{c.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 border border-[#1a1a2e] rounded-lg p-6 bg-[#0f0f22]">
        <div className="text-[#555568] text-xs uppercase tracking-widest mb-2">Need help?</div>
        <p className="text-sm">
          Join the Discord for API support, to request a Developer key, or to report issues.
          Community-built integrations are welcome.
        </p>
        <div className="flex gap-4 mt-4">
          <a
            href="https://discord.gg/paste-trade"
            className="text-[#3b82f6] text-sm hover:underline"
          >
            Discord
          </a>
          <a
            href="https://github.com/rohunvora/paste-trade"
            className="text-[#3b82f6] text-sm hover:underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
