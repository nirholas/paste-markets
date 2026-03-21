#!/usr/bin/env node
/**
 * MCP Server for paste-dashboard
 *
 * Exposes paste-dashboard API endpoints as MCP tools so Claude and other
 * MCP clients can query CT trader leaderboards, profiles, comparisons, etc.
 *
 * Usage:
 *   PASTE_DASHBOARD_URL=http://localhost:3000 node dist/index.js
 *
 * Or configure in Claude Desktop / Claude Code settings.json:
 *   {
 *     "mcpServers": {
 *       "paste-dashboard": {
 *         "command": "node",
 *         "args": ["/path/to/paste-dashboard/mcp/dist/index.js"],
 *         "env": { "PASTE_DASHBOARD_URL": "http://localhost:3000" }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.PASTE_DASHBOARD_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json as Record<string, string>).error ?? res.statusText;
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return json;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "paste-dashboard",
  version: "0.1.0",
  description:
    "Query CT (Crypto Twitter) trader performance data — leaderboards, profiles, head-to-head comparisons, trending traders, and AI trade analysis.",
});

// ---------------------------------------------------------------------------
// Tool: get_author
// ---------------------------------------------------------------------------

server.registerTool(
  "get_author",
  {
    description:
      "Fetch a CT trader's profile, metrics (win rate, avg P&L, streak), and recent trade history from paste.trade data.",
    inputSchema: z.object({
      handle: z
        .string()
        .describe("Twitter handle of the trader (with or without @)"),
    }),
  },
  async ({ handle }) => {
    const clean = handle.replace(/^@/, "").toLowerCase().trim();
    const data = await apiFetch(`/api/author/${encodeURIComponent(clean)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_leaderboard
// ---------------------------------------------------------------------------

server.registerTool(
  "get_leaderboard",
  {
    description:
      "Get the ranked leaderboard of CT traders. Sortable by win rate, avg P&L, or total trades. Supports timeframe filtering and pagination.",
    inputSchema: z.object({
      timeframe: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time window for ranking (default: 30d)"),
      sort: z
        .enum(["win_rate", "avg_pnl", "total_trades"])
        .optional()
        .describe("Sort field (default: win_rate)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of results (default: 50, max: 100)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Pagination offset (default: 0)"),
      min_trades: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Minimum trade count filter (default: 5)"),
    }),
  },
  async ({ timeframe, sort, limit, offset, min_trades }) => {
    const qs = buildQuery({ timeframe, sort, limit, offset, min_trades });
    const data = await apiFetch(`/api/leaderboard${qs}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: compare_traders
// ---------------------------------------------------------------------------

server.registerTool(
  "compare_traders",
  {
    description:
      "Head-to-head comparison of two CT traders. Returns per-dimension winners (win rate, avg P&L, best trade) and shared tickers with each trader's P&L.",
    inputSchema: z.object({
      trader_a: z.string().describe("Handle of the first trader"),
      trader_b: z.string().describe("Handle of the second trader"),
      timeframe: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time window for comparison (default: 30d)"),
    }),
  },
  async ({ trader_a, trader_b, timeframe }) => {
    const a = trader_a.replace(/^@/, "").toLowerCase().trim();
    const b = trader_b.replace(/^@/, "").toLowerCase().trim();
    const qs = buildQuery({ a, b, timeframe });
    const data = await apiFetch(`/api/vs${qs}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: search_traders
// ---------------------------------------------------------------------------

server.registerTool(
  "search_traders",
  {
    description:
      "Search for CT traders by handle prefix. Returns matching traders with win rate and trade count.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Handle prefix or partial name to search"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default: 10)"),
    }),
  },
  async ({ query, limit }) => {
    const qs = buildQuery({ q: query, limit });
    const data = await apiFetch(`/api/search${qs}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_trending
// ---------------------------------------------------------------------------

server.registerTool(
  "get_trending",
  {
    description:
      "Get the top 10 most-viewed CT traders in the past 24 hours on paste-dashboard.",
    inputSchema: z.object({}),
  },
  async () => {
    const data = await apiFetch("/api/trending");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_circle
// ---------------------------------------------------------------------------

server.registerTool(
  "get_circle",
  {
    description:
      "Get the CT Caller Circle — the top 25 traders organized into 3 tiers (inner: 5, middle: 8, outer: 12) by performance.",
    inputSchema: z.object({
      timeframe: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .describe("Time window (default: 30d)"),
    }),
  },
  async ({ timeframe }) => {
    const qs = buildQuery({ timeframe });
    const data = await apiFetch(`/api/circle${qs}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: analyze_trade
// ---------------------------------------------------------------------------

server.registerTool(
  "analyze_trade",
  {
    description:
      "Submit a URL or thesis to paste.trade for trade extraction. For URLs (tweet, article, YouTube), paste.trade extracts the trade and locks entry price for P&L tracking. Returns source_id and source_url.",
    inputSchema: z.object({
      input: z
        .string()
        .min(1)
        .describe(
          "URL (tweet, article, YouTube) or plain-text thesis to extract a trade from",
        ),
    }),
  },
  async ({ input }) => {
    const isUrl = /^https?:\/\//i.test(input.trim());
    if (isUrl) {
      const res = await apiFetch("/api/submit", {
        method: "POST",
        body: JSON.stringify({ url: input.trim() }),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    } else {
      const res = await apiFetch("/api/trade", {
        method: "POST",
        body: JSON.stringify({ input }),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: submit_url
// ---------------------------------------------------------------------------

server.registerTool(
  "submit_url",
  {
    description:
      "Submit a tweet, article, or YouTube URL to paste.trade for trade extraction and P&L tracking. Returns a source_id and source_url for the live trade card.",
    inputSchema: z.object({
      url: z.string().url().describe("Tweet, article, or YouTube URL to extract a trade from"),
    }),
  },
  async ({ url }) => {
    const res = await apiFetch("/api/submit", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_wrapped
// ---------------------------------------------------------------------------

server.registerTool(
  "get_wrapped",
  {
    description:
      "Get a CT Wrapped report card for a trader — Spotify-Wrapped style summary of their trading personality, P&L stats, and best/worst calls.",
    inputSchema: z.object({
      handle: z.string().describe("Twitter handle of the trader"),
    }),
  },
  async ({ handle }) => {
    const clean = handle.replace(/^@/, "").toLowerCase().trim();
    const data = await apiFetch(`/api/wrapped/${encodeURIComponent(clean)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
