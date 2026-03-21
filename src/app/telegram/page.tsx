import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "paste.markets on Telegram",
  description: "Real-time CT trade alerts, caller lookups, and leaderboards — right in Telegram.",
  openGraph: {
    title: "paste.markets on Telegram",
    description: "Real-time CT trade alerts, caller lookups, and leaderboards — right in Telegram.",
  },
};

// Telegram-style message bubble
function BotMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1a2836] border border-[#2a3f52] rounded-xl rounded-tl-sm px-4 py-3 max-w-sm text-sm leading-relaxed">
      {children}
    </div>
  );
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#2b5278] border border-[#3a6a94] rounded-xl rounded-tr-sm px-4 py-3 max-w-xs text-sm ml-auto">
      {children}
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-xl mt-0.5">{icon}</span>
      <div>
        <p className="text-text-primary font-bold text-sm">{title}</p>
        <p className="text-text-secondary text-xs mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function TelegramPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-[#0088cc]/10 border border-[#0088cc]/30 rounded-lg px-4 py-1.5 mb-6">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#0088cc]" aria-hidden>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          <span className="text-[#0088cc] text-xs font-bold uppercase tracking-wider">Telegram Bot</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
          paste.markets on Telegram
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto">
          Real-time trade alerts, caller lookups, and leaderboards &mdash; right in your Telegram chats.
        </p>

        <a
          href="https://t.me/paste_markets_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#0088cc] hover:bg-[#006fa3] text-white font-bold rounded-lg transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          Add to Telegram
        </a>
      </div>

      {/* Two columns: features + preview */}
      <div className="grid md:grid-cols-2 gap-12 mb-16">
        {/* Features */}
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-6">Bot Features</h2>
          <div className="space-y-5">
            <FeatureItem
              icon="\u{1F514}"
              title="Real-time Trade Alerts"
              desc="Get notified the moment a caller posts a new trade. Subscribe to any caller with /subscribe."
            />
            <FeatureItem
              icon="\u{1F50D}"
              title="Caller Lookup"
              desc="Check any caller's stats instantly with /caller @handle — win rate, P&L, streak."
            />
            <FeatureItem
              icon="\u{1F4CA}"
              title="Ticker Search"
              desc="Look up any ticker with /ticker $NVDA to see how callers are trading it."
            />
            <FeatureItem
              icon="\u{1F4C5}"
              title="Daily Recap"
              desc="Automated daily summary of the best calls, biggest movers, and top callers."
            />
            <FeatureItem
              icon="\u{1F3C6}"
              title="Leaderboard"
              desc="Pull up the leaderboard anytime with /top 7d to see who's winning."
            />
          </div>
        </div>

        {/* Chat preview */}
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-6">Preview</h2>
          <div className="bg-[#0e1621] border border-border rounded-2xl p-5 space-y-3">
            {/* Conversation mockup */}
            <UserMessage>/caller frankdegods</UserMessage>

            <BotMessage>
              <p className="font-bold text-text-primary mb-2">@frankdegods</p>
              <p className="text-text-secondary">
                Trades: 47<br />
                Win Rate: 72% {"\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591"}<br />
                Avg P&L: +8.3%<br />
                Streak: +5
              </p>
              <p className="text-[#0088cc] text-xs mt-2">View Profile</p>
            </BotMessage>

            <div className="h-2" />

            <BotMessage>
              <p className="mb-1">
                <span className="text-[#2ecc71]">{"\u{1F7E2}"}</span>{" "}
                <span className="font-bold text-text-primary">NEW CALL</span>
              </p>
              <p className="text-text-secondary">
                @frankdegods {"\u2192"} LONG $NVDA<br />
                Entry: $142.50<br />
                Platform: Robinhood
              </p>
              <p className="text-[#0088cc] text-xs mt-2">Track it {"\u2192"} paste.markets/frankdegods</p>
            </BotMessage>

            <div className="h-2" />

            <UserMessage>/top 7d</UserMessage>

            <BotMessage>
              <p className="font-bold text-text-primary mb-2">Leaderboard &mdash; 7d</p>
              <div className="text-text-secondary text-xs space-y-0.5 font-mono">
                <p>1. @frankdegods &nbsp;72% WR &nbsp;+8.3% avg</p>
                <p>2. @hsaka_eth &nbsp;&nbsp;68% WR &nbsp;+6.1% avg</p>
                <p>3. @cobie &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;65% WR &nbsp;+5.8% avg</p>
              </div>
            </BotMessage>
          </div>
        </div>
      </div>

      {/* Commands reference */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Commands</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            { cmd: "/start", desc: "Welcome message + setup instructions" },
            { cmd: "/caller {handle}", desc: "Look up a caller's stats" },
            { cmd: "/ticker {symbol}", desc: "Look up a ticker" },
            { cmd: "/top {timeframe}", desc: "Leaderboard (7d, 30d, 90d)" },
            { cmd: "/subscribe {handle}", desc: "Get alerts for a caller" },
            { cmd: "/help", desc: "List all commands" },
          ].map((c) => (
            <div key={c.cmd} className="flex gap-3">
              <code className="text-[#0088cc] font-mono text-xs whitespace-nowrap">{c.cmd}</code>
              <span className="text-text-muted text-xs">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-12">
        <p className="text-text-muted text-sm mb-4">Works in groups, channels, and DMs</p>
        <a
          href="https://t.me/paste_markets_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 border border-[#0088cc] text-[#0088cc] hover:bg-[#0088cc] hover:text-white font-bold rounded-lg transition-colors"
        >
          Open in Telegram
        </a>
      </div>
    </main>
  );
}
