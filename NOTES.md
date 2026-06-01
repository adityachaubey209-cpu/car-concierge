# Build Notes — decisions log

A working log kept while building. Source material for the README.

## Decisions (in order made)

| # | Decision | Why |
|---|---|---|
| 1 | Conversational shortlister, not catalog-with-filters | The brief explicitly punishes the "half-finished kitchen sink" |
| 2 | Next.js 16 App Router (single repo) | Frontend + API in one deploy. RSC available if needed. |
| 3 | Tailwind v4 + shadcn/ui (slate) | Beautiful baseline UI in minutes |
| 4 | Vercel AI SDK v6 with `streamText` + tool-calling | Provider-agnostic, native streaming, idiomatic tool schemas via Zod |
| 5 | Anthropic via OpusMax (initial plan) → swapped to Google Gemini | OpusMax key expired mid-session. SDK abstraction made the swap painless (~10 min). Kept `.env.example` documenting both. |
| 6 | Static `cars.json` (36 cars), no DB | At this scale a DB is ceremony. Curated by hand for accurate 2025 Indian pricing. |
| 7 | Default model: `gemini-2.5-flash-lite` | 30 RPM free-tier vs 5–10 on flash/pro. No thinking-token overhead. Smart enough for this task. |
| 8 | `stopWhen: stepCountIs(4)` | AI SDK v6 default is 1, which means the model calls the tool but never writes the recap. Cost me 10 min to debug from the raw SSE. |
| 9 | `thinkingBudget: 0` + `maxOutputTokens: 2048` | Found Gemini 2.5 Flash truncating mid-recap with `finishReason: "other"`. Internal thinking tokens were eating output. |
| 10 | Compare uses direct client import (`getCarsByIds`), not a `/api/cars/[id]` route | 30KB JSON, immutable, public. Round-tripping it for 1–3 cars adds latency for zero benefit. |
| 11 | Edit-and-resend via `setMessages` + `sendMessage` | Idiomatic v6 pattern. Truncates stale assistant reply, fires a fresh streamed turn. |
| 12 | `formatChatError` parses Google's quota error to a one-liner | Default error is a 300-char wall of regex-noise. UX matters even for failure states. |

## Deliberately cut (and why)

- Accounts / auth — zero MVP value
- Persistent chat — per-session is enough
- CarDekho live scrape — ToS risk + plumbing-heavy
- Image thumbnails — biggest visible gap, called out in README
- Reviews ingestion — would dominate the time budget alone
- `make` and `transmission` filters on the tool — closed off by Gemini answering in text instead; called out as "known edge gap"
- API route for car detail fetching — replaced with client import

## With another 4 hours

- Image thumbnails per car (biggest gap)
- Add `make` + `transmission` to tool schema (5-min fix, just out of scope)
- Share-a-shortlist via URL state
- Voice input (Web Speech)
- Eval harness: 20 user briefs → golden top-3 cars → regression-test prompt changes
- Mobile compare carousel (current grid is cramped at <500px)

## AI tool usage log (real moments from the session)

### Wins
- Asked Cursor to read `node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx` before writing API code — it used the v6 `inputSchema` field, not the v5 `parameters`. Internet tutorials would have led it wrong.
- Provider swap (OpusMax → Gemini) was a single-file change because of the SDK abstraction. Validated my choice of going with AI SDK over direct provider SDKs.
- Edit-and-resend feature went from request to working UI in ~12 minutes including state, handlers, edit textarea, keyboard shortcuts.

### Garbage / required course-correction
- First implementation of `streamText` had no `stopWhen` — recap never streamed. Debugged from the raw SSE.
- First Gemini run with Flash 2.5 + thinking → truncated recaps. Adding `maxOutputTokens` alone wasn't enough; had to also cap thinking.
- Compare button initially appeared on cards even when no compare handler was wired. Fixed by making the button conditional on `onCompare` being passed.
- AI initially wanted to render the dataset's `pros` and `cons` (4-5 items each) — too noisy for cards. Capped at 2 in the compare view, 3 in the card.

### Manual override (where I pushed back hardest)
- Said no to `/api/cars/[id]` route — useless network hop for static data.
- Said no to a `make` filter expansion before launch — would have eaten time better spent on the compare + edit features.
- Resisted shadcn `Dialog` for compare; insisted on `Sheet` — much better UX for spec tables.
