# Task 16: Add submit_url Tool to MCP Server

## Goal
Add a `submit_url` tool to the paste-dashboard MCP server so Claude and other MCP clients can submit trade sources to paste.trade directly through the MCP interface. Also update `analyze_trade` to use the new submission flow instead of the broken Claude-based route.

## Context
- MCP server source: `paste-dashboard/mcp/src/index.ts`
- Built output: `paste-dashboard/mcp/dist/index.js`
- The MCP server proxies to a running paste-dashboard instance via `PASTE_DASHBOARD_URL`
- Task 13 adds `POST /api/submit` to paste-dashboard — this tool calls that route
- The `analyze_trade` tool currently calls `POST /api/trade` which uses Claude — replace it with the new `POST /api/submit`

## What To Build

### 1. Add `submit_url` tool to `mcp/src/index.ts`

```typescript
server.tool("submit_url", {
  description: "Submit a tweet, article, or YouTube URL to paste.trade for trade extraction and P&L tracking. Returns a source_id and source_url for the live trade card.",
  inputSchema: z.object({
    url: z.string().url().describe("Tweet, article, or YouTube URL to extract a trade from"),
  }),
}, async ({ url }) => {
  const res = await apiFetch("/api/submit", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  return {
    content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
  };
});
```

Update `apiFetch` helper to support POST:
```typescript
async function apiFetch(path: string, options?: RequestInit) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API error ${res.status}: ${json.error ?? res.statusText}`);
  return json;
}
```

### 2. Replace `analyze_trade` tool

The existing `analyze_trade` tool calls `POST /api/trade` (Claude-based, broken for URLs). Replace its implementation to call `POST /api/submit` instead:

```typescript
server.tool("analyze_trade", {
  description: "Submit a URL or thesis to paste.trade for trade extraction. For URLs (tweet, article, YouTube), paste.trade extracts the trade and locks entry price for P&L tracking. Returns source_id and source_url.",
  inputSchema: z.object({
    input: z.string().min(1).describe("URL (tweet, article, YouTube) or plain-text thesis to extract a trade from"),
  }),
}, async ({ input }) => {
  const isUrl = /^https?:\/\//i.test(input.trim());
  if (isUrl) {
    // Use paste.trade submission for URLs
    const res = await apiFetch("/api/submit", {
      method: "POST",
      body: JSON.stringify({ url: input.trim() }),
    });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  } else {
    // Plain text — still call old route for now (text theses)
    const res = await apiFetch("/api/trade", {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
});
```

### 3. Rebuild the MCP package

After editing `mcp/src/index.ts`, run:
```bash
cd paste-dashboard/mcp && npm run build
```

Verify `dist/index.js` is updated (check the timestamp or grep for `submit_url`).

### 4. Update `server.json`

The `analyze_trade` tool description in server.json comments is implicit — no change needed there. But if there's a tools list anywhere in docs, update it.

## Validation
1. `cd paste-dashboard/mcp && npm run build` — must succeed with no TypeScript errors
2. `grep -l "submit_url" paste-dashboard/mcp/dist/index.js` — confirms tool is in built output
3. The `apiFetch` helper must support both GET and POST

## Do NOT
- Remove any existing tools (get_author, get_leaderboard, compare_traders, etc.)
- Change the MCP server name or version
- Break the stdio transport
- Modify `server.json` or `package.json` in the mcp directory
