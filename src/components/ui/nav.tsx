"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { SearchTrigger } from "@/components/search-bar";
import NotificationBell from "@/components/notification-bell";
import { WalletButton } from "@/components/wallet-button";

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/alpha", label: "Alpha" },
  { href: "/discover", label: "Discover" },
  { href: "/predictions", label: "Markets" },
];

const MORE_LINKS = [
  { href: "/today", label: "Today" },
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
        className={`flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors ${
          isMoreActive
            ? "text-[#f5f5f7] bg-[#ffffff14]"
            : "text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a]"
        }`}
      >
        More
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-52 bg-[#1a1a1a] border border-[#ffffff14] rounded-2xl shadow-2xl z-50 py-2 max-h-80 overflow-y-auto">
          {MORE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 text-[13px] transition-colors ${
                pathname === link.href
                  ? "text-[#f5f5f7] bg-[#ffffff0a]"
                  : "text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a]"
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
    <div ref={ref} className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors p-1.5 rounded-lg hover:bg-[#ffffff0a]"
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
        <div className="absolute left-0 right-0 top-full bg-[#111111] border-b border-[#ffffff0d] shadow-2xl z-50 px-4 py-4">
          <div className="grid grid-cols-2 gap-1">
            {[...NAV_LINKS, ...MORE_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                  pathname === link.href
                    ? "text-[#f5f5f7] bg-[#ffffff0a]"
                    : "text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a]"
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
    <nav className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-[#ffffff0d] px-4 lg:px-6">
      <div className="max-w-6xl mx-auto flex items-center h-14 gap-2">
        {/* Logo */}
        <Link href="/" className="text-[#f5f5f7] font-bold text-lg tracking-tight hover:opacity-80 transition-opacity shrink-0 mr-4">
          paste<span className="text-[#6366f1]">.</span>markets
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                pathname === link.href
                  ? "text-[#f5f5f7] bg-[#ffffff14]"
                  : "text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-[#ffffff0a]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <MoreDropdown pathname={pathname} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          <Link
            href="/submit"
            className="hidden sm:flex items-center gap-1.5 text-[13px] font-semibold px-4 py-1.5 rounded-full bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
          >
            Submit Call
          </Link>
          <SearchTrigger />
          <NotificationBell />
          <WalletButton />
          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </nav>
  );
}
