import Link from "next/link";

export default function Nav() {
  return (
    <nav className="bg-surface border-b border-border px-6 py-3 font-mono flex items-center gap-8">
      <Link href="/" className="text-text-primary font-bold text-lg tracking-tight hover:text-accent transition">
        paste.markets
      </Link>
      <div className="flex items-center gap-6">
        <Link href="/leaderboard" className="text-text-muted hover:text-accent transition text-sm">
          Leaderboard
        </Link>
        <Link href="/alpha" className="text-[#2ecc71] hover:text-[#f0f0f0] transition text-sm font-bold">
          Alpha
        </Link>
        <Link href="/signal" className="text-text-muted hover:text-accent transition text-sm">
          Signal
        </Link>
        <Link href="/signals" className="text-text-muted hover:text-accent transition text-sm">
          Signals
        </Link>
        <Link href="/portfolio" className="text-text-muted hover:text-accent transition text-sm">
          Portfolio
        </Link>
        <Link href="/submit" className="text-text-muted hover:text-accent transition text-sm">
          Submit
        </Link>
        <Link href="/feed" className="text-text-muted hover:text-accent transition text-sm">
          Feed
        </Link>
        <Link href="/trade" className="text-text-muted hover:text-accent transition text-sm">
          Trade
        </Link>
        <Link href="/circle" className="text-text-muted hover:text-accent transition text-sm">
          Circle
        </Link>
        <Link href="/consensus" className="text-text-muted hover:text-accent transition text-sm">
          Consensus
        </Link>
        <Link href="/heatmap" className="text-text-muted hover:text-accent transition text-sm">
          Heatmap
        </Link>
        <Link href="/docs" className="text-text-muted hover:text-accent transition text-sm">
          Docs
        </Link>
        <Link href="/fade" className="text-text-muted hover:text-accent transition text-sm">
          Fade
        </Link>
      </div>
    </nav>
  );
}
