"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { SearchTrigger } from "@/components/search-bar";
import NotificationBell from "@/components/notification-bell";
import { WalletButton } from "@/components/wallet-button";

const PRIMARY_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/feed", label: "Feed" },
  { href: "/alpha", label: "Alpha" },
  { href: "/discover", label: "Discover" },
  { href: "/submit", label: "Submit" },
];

const MORE_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/predictions", label: "Predictions" },
  { href: "/events", label: "Events" },
  { href: "/signals", label: "Signals" },
  { href: "/consensus", label: "Consensus" },
  { href: "/heatmap", label: "Heatmap" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/positions", label: "Positions" },
  { href: "/trade", label: "Trade" },
  { href: "/callers", label: "Callers" },
  { href: "/circle", label: "Circle" },
  { href: "/wall", label: "Wall" },
  { href: "/fade", label: "Fade" },
  { href: "/simulate", label: "Simulate" },
  { href: "/alerts", label: "Alerts" },
  { href: "/docs", label: "Docs" },
];

function MoreDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const isMoreActive = MORE_LINKS.some((l) => pathname === l.href);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`text-sm transition-colors ${
          isMoreActive ? "text-[#f0f0f0]" : "text-[#555568] hover:text-[#c8c8d0]"
        }`}
      >
        More
        <svg
          className={`inline-block ml-1 w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-48 bg-[#0f0f22] border border-[#1a1a2e] rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
          {MORE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                pathname === link.href
                  ? "text-[#f0f0f0] bg-[#1a1a2e]"
                  : "text-[#c8c8d0] hover:text-[#f0f0f0] hover:bg-[#1a1a2e]/50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="text-[#555568] hover:text-[#c8c8d0] transition-colors p-1"
        aria-label="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full bg-[#0f0f22] border-b border-[#1a1a2e] shadow-xl z-50 px-4 py-3">
          <div className="grid grid-cols-2 gap-1">
            {[...PRIMARY_LINKS, ...MORE_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  pathname === link.href
                    ? "text-[#f0f0f0] bg-[#1a1a2e]"
                    : "text-[#c8c8d0] hover:text-[#f0f0f0] hover:bg-[#1a1a2e]/50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 bg-[#0a0a1a]/80 backdrop-blur-md border-b border-[#1a1a2e]/80 px-4 md:px-6 py-3 font-mono">
      <div className="max-w-7xl mx-auto flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="text-[#f0f0f0] font-bold text-lg tracking-tight hover:text-[#3b82f6] transition-colors shrink-0">
          paste<span className="text-[#3b82f6]">.</span>markets
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm px-3 py-1.5 rounded transition-colors ${
                pathname === link.href
                  ? "text-[#f0f0f0] bg-[#1a1a2e]/60"
                  : "text-[#555568] hover:text-[#c8c8d0] hover:bg-[#1a1a2e]/30"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <MoreDropdown pathname={pathname} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 ml-auto">
          <SearchTrigger />
          <NotificationBell />
          <WalletButton />
          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </nav>
  );
}
