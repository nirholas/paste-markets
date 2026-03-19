# Events

Accepted event types:

- `status` — phase progress (ephemeral, WebSocket only)
- `extraction_complete` — extraction phase finished
- `enriching` — enrichment phase in progress
- `source_updated` — metadata push (author, date, thumbnail)
- `thought` — narration/insight messages (ephemeral, WebSocket only)
- `thesis_found` — thesis extracted and saved
- `thesis_routing` — emitted by route.ts when routing begins for a thesis
- `thesis_routed` — emitted by save.ts on successful route update
- `thesis_dropped` — emitted by save.ts when a thesis is marked unrouted (final)
- `trade_posted` — emitted by post.ts after a trade is posted
- `done` — successful completion (terminal)
- `failed` — processing failed (terminal)
- `error` — error occurred (terminal)
