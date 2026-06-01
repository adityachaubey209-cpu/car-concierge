# Recorded Build Playbook

This is the **on-camera script** for the 2–3 hour build. Hit record on Loom, open this file in a side panel, and follow it. Improvise — the recording is supposed to show *your* judgement, not a rehearsal.

> **Golden rule:** narrate every decision out loud, even the obvious ones. *"I'm using a tool call here instead of stuffing the whole catalog in the prompt because…"*

---

## Pre-record checklist (2 min)

- [ ] `.env.local` has a real `ANTHROPIC_API_KEY`
- [ ] `npm run dev` boots → http://localhost:3000 shows the "Scaffolding ready" page
- [ ] Loom is recording **screen + mic + webcam (optional)**
- [ ] Browser, editor, and terminal are visible
- [ ] Close Slack/email/notifications

---

## Phase 1 — Frame the build (5 min)

**On camera, say something like:**
> "The brief is: help a confused buyer go from 'I don't know what to buy' to 'I'm confident about my shortlist'. The lazy version is a car catalog with filters — but anyone can do that. I'm building a **conversational AI shortlister** instead, because that's the highest-leverage thing for a confused buyer. I have 35 popular Indian cars in a static JSON, and the AI will use tool calls to filter & rank them based on what the user describes."

**Show:**
- `src/lib/data/cars.json` (scroll through, mention the rich `bestFor`/`pros`/`cons` fields you put in *for the AI to reason on*).
- `src/lib/types.ts` (show the typed shape).
- The current landing page in the browser.

---

## Phase 2 — Build the streaming chat API route (~30 min)

**Goal:** A `POST /api/chat` route using Vercel AI SDK + Claude that streams responses and can call tools.

**Prompt for Cursor (paste verbatim, then review and edit before accepting):**

> Create `src/app/api/chat/route.ts` for a Next.js 16 App Router project. Use Vercel AI SDK v6 (`ai` package v6+) with `streamText` and the `@ai-sdk/anthropic` provider. Read the up-to-date API conventions from `node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx` and `node_modules/ai/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx` before writing any code. The route should:
>
> 1. Accept `{ messages: UIMessage[] }` and call `streamText` with Claude (default model `claude-sonnet-4-5`, override via `process.env.ANTHROPIC_MODEL`).
> 2. Set `maxDuration = 60` for Vercel.
> 3. Have a system prompt that frames Claude as an Indian car-buying concierge. The prompt should: (a) ask 1–3 clarifying questions if the user's brief is vague, (b) use the `shortlistCars` tool to return 3–5 cars when ready, (c) write personalized "why this fits you" reasons per car. The tone is friendly, direct, no marketing fluff.
> 4. Expose ONE server-side tool `shortlistCars(criteria)` whose `inputSchema` (zod) captures filter criteria: `maxPriceLakhs`, `minSeats`, `bodyTypes[]`, `fuelTypes[]`, `mustHaveSafety` (boolean for 4★+), `preferredUseCase` (free text), and `topN` (default 5). The `execute` function should:
>    - Load cars via `getAllCars()` from `@/lib/cars`.
>    - Filter by hard constraints (price, seats, body, fuel, safety).
>    - Score remaining cars: +2 for each matching `bestFor` tag inferred from `preferredUseCase` (do a simple keyword match — "family"→young-family/large-family, "city"→city-commute, "highway"→highway-cruiser, "mileage"→fuel-economy, "safe"→safety-first, "off-road"→off-road-enthusiast, "premium"→premium-feel). +1 for safety rating ≥ 4. +1 for being within the lower 60% of price range.
>    - Return the top N cars with a structured payload: `{ id, name, priceRange, summary, matchScore, matchReasons[] }`.
> 5. Return `result.toUIMessageStreamResponse()`.
>
> Use TypeScript strictly. No `any`. Don't catch errors silently — let them throw to surface in dev.

**Course-correction script (if Cursor outputs garbage):**
- Reads docs wrong? → "The `tools` API uses `inputSchema` not `parameters` in AI SDK v6. Fix it."
- Forgets to `convertToModelMessages`? → "You need to convert UIMessage[] to ModelMessage[] using `convertToModelMessages`."
- Hallucinates field names? → "Look at `src/lib/types.ts` for the real shape of Car."

**Test it manually** with `curl`:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"I have 12 lakh budget, family of 4, mostly city"}]}]}'
```
Show the stream coming through on camera.

---

## Phase 3 — Build the chat UI (~45 min)

**Prompt for Cursor:**

> Replace `src/app/page.tsx` with a "Car Concierge" chat UI. Use the `useChat` hook from `@ai-sdk/react` with `DefaultChatTransport` (read `node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx` for the v6 API). The layout:
>
> - Full-height single column, max-width 4xl, centered.
> - Sticky header with the title "Car Concierge" and a one-liner subtitle.
> - Scrollable messages area in the middle. Each message renders as a chat bubble: user right-aligned, assistant left-aligned, with avatars (Lucide `User` and `Sparkles` icons).
> - For each message, iterate `message.parts`. If `part.type === 'text'`, render markdown-style text. If `part.type === 'tool-shortlistCars'`, render a `<CarShortlist>` component with the tool result.
> - Sticky composer at the bottom: a `<Textarea>` (shadcn) with a Send button and a placeholder like "Tell me what kind of car you need… (budget, family size, usage)". Cmd/Ctrl+Enter sends.
> - When `status === 'streaming'`, show a "Thinking…" indicator above the composer.
> - Empty state (no messages yet): show three suggestion-pill buttons that pre-fill the textarea: ("Budget 10L, daily city use", "First car for my family of 4, prioritise safety", "Long highway drives, premium feel"). Clicking a pill calls `sendMessage({ text: '...' })`.
>
> Use shadcn primitives that already exist: `Button`, `Textarea`, `Card`, `Badge`, `Avatar`, `Separator`, `ScrollArea`. Tailwind v4. Mobile-first, but it must look good on desktop too.

**Then build the shortlist component:**

> Create `src/components/car-shortlist.tsx`. Props: `cars: Array<{ id, name, priceRange: {min,max}, summary, matchScore, matchReasons: string[] }>`. Render as a horizontally-scrolling row of `<Card>` components (vertical stack on mobile). Each card shows: car name, price range (₹X.X – ₹Y.Y L), summary line, then a list of 2-3 `matchReasons` as bulleted text with a small ✓ icon. Add a "Compare" button at the top right of each card (no-op for now, we'll wire it later). The match score appears as a small `Badge` in the corner.

---

## Phase 4 — Add a compare view (~30 min)

**Prompt:**

> Build a "Compare" sheet. When the user clicks Compare on one or more cars, they get added to a comparison list (state in the page component, max 3). A floating bottom-right pill shows "Compare (N)" — clicking opens a shadcn `<Sheet>` from the right side with a side-by-side comparison table. Rows: Price, Body Type, Seats, Fuel, Mileage, Power, Safety, Key Pros, Key Cons. Pull data via `getCarById` from `@/lib/cars` — expose it as a server-side helper or a `GET /api/cars/[id]` route.

---

## Phase 5 — Polish + deploy (~30 min)

1. **Manual QA**: try 5 personas on camera.
   - "5L budget, first car, mostly office commute"
   - "Family of 6, going on long trips, safety is #1"
   - "I want an EV under 20L for daily city use"
   - "Want something premium and fun to drive, under 20L"
   - "I don't know, surprise me" (tests handling vague inputs)
2. **Refinement messages** — verify follow-ups work: "show me cheaper ones", "what about hybrids?", "compare the Creta and Seltos"
3. **README** — fill in the four required sections (see `README.md`).
4. **Deploy** to Vercel:
   ```bash
   npx vercel --prod
   # Set env var ANTHROPIC_API_KEY in the Vercel dashboard
   ```
5. **Final demo on camera** — show the deployed URL working.

---

## Things to mention out loud during the recording

- *"I picked Anthropic over OpenAI because Claude is genuinely better at structured tool calls and natural reasoning…"*
- *"I'm putting the dataset in JSON instead of Postgres because no part of this needs a DB yet — overengineering kills shipping speed…"*
- *"Notice I'm reviewing this AI-generated code, not blindly accepting it — let me check the field name…"*
- *"This output is wrong — it's referencing a field that doesn't exist. Let me push back…"*
- *"What I'm deliberately NOT building: accounts, payments, real-time scraping, image gallery. None of those move the needle for a confused buyer."*

---

## What "done" looks like

- [x] Scaffold (this part)
- [ ] Streaming chat with Claude on `/api/chat`
- [ ] Chat UI on `/` with suggestion pills
- [ ] `shortlistCars` tool call returns rich payloads
- [ ] Shortlist cards render with personalised reasons
- [ ] Compare sheet works for 2-3 cars
- [ ] Refinement queries work (cheaper / hybrid / specific model)
- [ ] Deployed to Vercel with working URL
- [ ] README written
- [ ] Loom recording uploaded
