import Link from "next/link";
import { SearchTrigger } from "@/components/search-bar";
import NotificationBell from "@/components/notification-bell";
import { WalletButton } from "@/components/wallet-button";

export default function Nav() {
  return (
    <nav className="bg-surface border-b border-border px-6 py-3 font-mono flex items-center gap-8">
      <Link href="/" className="text-text-primary font-bold text-lg tracking-tight hover:text-accent transition">
        paste.markets
      </Link>
      <div className="flex items-center gap-6 flex-1">
        <Link href="/today" className="text-[#f39c12] hover:text-[#f0f0f0] transition text-sm font-bold">
          Today
        </Link>
        <Link href="/leaderboard" className="text-text-muted hover:text-accent transition text-sm">
          Leaderboard
        </Link>
        <Link href="/predictions" className="text-amber hover:text-text-primary transition text-sm">
          Predictions
        </Link>
        <Link href="/events" className="text-win hover:text-text-primary transition text-sm font-bold">
          Events
        </Link>
        <Link href="/alpha" className="text-[#2ecc71] hover:text-[#f0f0f0] transition text-sm font-bold">
          Alpha
        </Link>
        <Link href="/discover" className="text-text-muted hover:text-accent transition text-sm">
          Discover
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
        <Link href="/wall" className="text-text-muted hover:text-accent transition text-sm">
          Wall
        </Link>
        <Link href="/docs" className="text-text-muted hover:text-accent transition text-sm">
          Docs
        </Link>
        <Link href="/fade" className="text-text-muted hover:text-accent transition text-sm">
          Fade
        </Link>
        <Link href="/simulate" className="text-text-muted hover:text-accent transition text-sm">
          Simulate
        </Link>
        <Link href="/positions" className="text-accent hover:text-text-primary transition text-sm font-bold">
          Positions
        </Link>
        <Link href="/telegram" className="text-[#0088cc] hover:text-text-primary transition text-sm">
          Telegram
        </Link>
        <Link href="/join" className="text-win hover:text-text-primary transition text-sm font-bold">
          Join
        </Link>
      </div>
      <WalletButton />
      <Link href="/alerts" className="text-text-muted hover:text-accent transition text-sm">
        Alerts
      </Link>
      <NotificationBell />
      <SearchTrigger />
    </nav>
  );
}
