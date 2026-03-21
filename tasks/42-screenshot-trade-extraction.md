# Task 42: Screenshot-to-Trade Extraction

## IMPORTANT
All work MUST happen inside `/workspaces/agent-payments-sdk/paste-dashboard/`. This is a public repo (nirholas/paste-markets). Do NOT touch anything outside this folder — agent-payments-sdk is a separate private repo.

## Goal
Let users upload a screenshot of a trade call (from Twitter, Discord, Telegram) and extract the trade info using AI vision. Many callers post screenshots instead of text — this captures those calls too.

## Context
Replies mentioned wanting to paste screenshots, not just URLs. Screenshots from trading apps, Discord messages, or Twitter images containing trade calls are extremely common in CT.

## Steps

### 1. Upload API
Create `src/app/api/extract/route.ts`:
- `POST /api/extract` — multipart form data with image file
- Accepts: PNG, JPG, WEBP (max 5MB)
- Sends image to Claude Vision API (claude-haiku-4-5-20251001 for speed/cost)
- Prompt: "Extract any trade call from this image. Return: ticker, direction (long/short/yes/no), entry price if visible, platform if identifiable, and the caller's handle if visible. Return JSON."
- Returns extracted trade data
- Requires `ANTHROPIC_API_KEY` env var

### 2. Upload component
Create `src/components/screenshot-upload.tsx` (client component):
- Drag-and-drop zone + click to upload
- Image preview after upload
- "Extracting..." loading state with scan animation
- Shows extracted trade info in editable form
- User can correct any misread fields
- "Submit trade" button to finalize

### 3. Integration with trade page
Update `/trade` page to include screenshot upload alongside URL input:
- Tab: "Paste URL" | "Upload Screenshot" | "Type thesis"
- Screenshot tab uses the upload component
- After extraction, flows into same trade submission pipeline

### 4. Image processing
In the API route:
- Validate file type and size
- Convert to base64 for Claude Vision API
- Parse Claude's response (handle edge cases: no trade found, ambiguous info)
- Return structured data or error message

### 5. Design
- Upload zone: dashed border (#1a1a2e), hover turns blue (#3b82f6)
- Drop state: border solid blue, bg tint
- Preview: image scaled to fit, dark overlay with extracted info
- Scan animation: horizontal line sweeping down the image
- Extracted fields: editable inputs pre-filled with AI results
