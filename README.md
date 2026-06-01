# Car Concierge

> An AI-powered shortlisting assistant that takes a confused buyer from *"I don't know what to buy"* to *"I'm confident about my shortlist."*
>
> **CarDekho Group — Software Engineer / Full Stack (AI-Native) take-home.** Built in ~3 hours with Cursor + Gemini.

## Live demo

- **App:** [<[Car concierge](https://car-concierge-pink.vercel.app/)>](https://car-concierge-pink.vercel.app/) _(replace before submitting)_

## What it does

Describe your situation in plain English — *"₹15L budget, family of 4, mostly city, want safety + good mileage"* — and the assistant streams back a personalized 3–5 car shortlist from a curated catalog of **36 popular Indian cars (₹4L – ₹31L, all body types & fuels)**.

Concretely:
- **Conversational shortlister.** Gemini reasons about your needs and calls a `shortlistCars` tool that filters + scores the catalog. Cards explain *"why this fits **you**"*, not generic specs.
- **Iterative refinement.** *"Show cheaper", "what about hybrids?", "actually I want a sedan"* — each follow-up re-runs the tool with updated filters.
- **Edit any prompt.** Click `✏ Edit` under any of your messages to rewrite it. The stale AI reply is dropped and a fresh response streams in. No need to start over.
- **Side-by-side compare.** Click `Compare` on up to 3 cars to open a sheet with price, body type, seats, fuel, mileage/range, power, safety stars, and key pros/cons.

## Run locally (under 2 minutes)

```bash
git clone <this-repo>
cd car-concierge
npm install
cp .env.example .env.local
# Open .env.local and paste your GEMINI_API_KEY (free key in 30s at https://aistudio.google.com/apikey)
npm run dev
```

Open <http://localhost:3000>. No DB. No auth. No setup wizards.

## Deploy

```bash
npx vercel               # link to your Vercel account
# Add GEMINI_API_KEY in the project's Environment Variables (Vercel dashboard)
npx vercel --prod
```

Vercel auto-detects Next.js. The `/api/chat` route is a serverless function with `maxDuration = 60` (within Hobby tier limits).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | One repo, one deploy, server functions live next to UI |
| Styling | Tailwind v4 + shadcn/ui (slate theme) | Beautiful baseline UI without a designer; primitives I can compose |
| AI | Vercel AI SDK v6 + `@ai-sdk/google` (Gemini 2.5 Flash-Lite) | Native streaming + tool-calling; flash-lite gives 30 RPM on the free tier with no thinking overhead. Overridable to `gemini-2.5-flash` / `pro` via env. |
| Data | Static `cars.json` (36 curated Indian cars) | The catalog is small and immutable — a DB would be ceremonial |
| Validation | Zod | Tool argument schemas, free runtime safety |
| Deploy | Vercel | Native Next.js, free tier covers the use case |

**Versions:** Node 22 · Next 16 · React 19 · Tailwind v4 · AI SDK v6 · TypeScript 5.

## Architecture in one paragraph

The client uses `useChat` from `@ai-sdk/react` over a `DefaultChatTransport` to stream messages from `/api/chat`. The route handler calls `streamText` against Gemini with `stopWhen: stepCountIs(4)` (so the model can call the tool, *then* write the recap) and a system prompt that frames it as an Indian car-buying concierge with hard rules (max 3 clarifying questions, only recommend tool-returned cars, prices in INR lakhs). The single server-side tool `shortlistCars` validates inputs via Zod, applies hard filters (price/seats/body/fuel/safety) in pure TypeScript, scores remaining cars (+2 per matched buyer-archetype tag, +1 for 4★+ safety, +1 for being in the lower 60% of the price band), and returns a structured payload. The UI iterates `message.parts`, rendering text parts as chat bubbles and `tool-shortlistCars` parts as the `<CarShortlist>` card grid. Compare state lives in the page; the `<CompareSheet>` is a controlled `Sheet` from shadcn that imports `getCarsByIds` directly (30KB JSON is fine to ship client-side and gives instant render). Edit-and-resend uses `setMessages` to truncate history then `sendMessage` to fire a fresh tool-call round.

## What I deliberately cut

- **Accounts / auth.** Adds zero value in a first-time buyer session.
- **Persistent shortlist history.** Per-session is enough for the MVP loop. URL sharing is the obvious next step (see "+4 hours").
- **Real-time CarDekho data scrape.** ToS risk + would eat the budget on plumbing. Disclosed: curated static dataset.
- **Image gallery, brochure links, dealer integrations.** Visual polish, not decision leverage.
- **Reviews ingestion / sentiment.** Would be the highest-value addition but is 3+ hours alone.
- **Make / transmission filters** on the tool schema. Caught during testing — see the "edge gaps" note below. Gemini handles them gracefully in chat (answers in text instead of filtering).
- **Per-route API for car details.** Used a client-side import instead — 30KB of static reference data round-tripping over HTTP made no sense.

## What I delegated to AI vs. did manually

**AI (Cursor + Gemini) did most of the typing:**
- Component scaffolding: chat bubbles, card grid, sheet layout, edit-mode UI
- Boilerplate around `streamText`, `useChat`, `DefaultChatTransport`
- The zod schema for `shortlistInputSchema` and the type definitions
- First-draft system prompt, refined by hand

**I drove all the judgement calls manually:**
- The **product framing** — concierge over catalog-with-filters. That's the whole grade.
- The **36-car catalog** — pricing, fuels, safety stars, `bestFor` archetypes, pros/cons. No LLM knows 2025 Indian car prices well enough to be trusted here unsupervised.
- The **scoring math** — `+2/+1/+1` weighting, the lower-60% price-band heuristic, tie-breaks.
- The **system prompt rules** — max 3 questions across a conversation, never invent cars outside the tool's output, "surprise me" default of ₹15L.

**Concrete moments where AI was wrong and I caught it on camera:**
- *AI SDK v6 default `stopWhen: stepCountIs(1)`* — the model called the tool then stopped without writing a recap. Found by reading the raw SSE stream and grepping `node_modules/ai/dist/index.d.ts`. Fix: `stopWhen: stepCountIs(4)`.
- *Gemini 2.5 Flash truncation* — the recap was cutting off mid-sentence with `finishReason: "other"`. The cause was internal "thinking" tokens eating the output budget. Fix: explicit `maxOutputTokens: 2048` + `thinkingConfig.thinkingBudget: 0`.
- *Provider swap mid-build* — started with Claude via OpusMax; the gateway key turned out to be expired. Swapped to Gemini in ~10 minutes (the SDK abstraction did its job). Documented both paths in `.env.example`.
- *Google's verbose rate-limit error* — would have shown the user a 300-character wall of regex-noise. Wrote a tiny `formatChatError` parser that extracts *"retry in Xs"* and shows a 1-line message.
- *Compare data architecture* — playbook gave a choice between API route and client import. AI initially scaffolded an API route; I dropped it after thinking through the actual UX (30KB static data, public, every-time-the-sheet-opens latency).

**Where AI helped most:** typing speed on idiomatic shadcn + AI-SDK code. The boilerplate would have cost me an hour by hand.

**Where AI got in the way:** every model I tried wanted to over-engineer — suggested Postgres, suggested file-based mocking, suggested abstract message-bus patterns. I had to actively cut. The brief explicitly punishes that and they were right to.

## Known edge gaps (honest list)

These are gaps I shipped with on purpose so we'd ship a tight MVP rather than a half-finished one:
- **Tool has no `make` or `transmission` filter** — *"show me only Tata cars"* / *"only automatic"* falls back to Gemini answering in text. Adding fields to the Zod schema is a 5-minute change.
- **No image thumbnails** — cards are text-only. Catalog has no image URLs.
- **5 RPM on `gemini-2.5-flash`** if you override the default — rapid testing can hit it. Default `flash-lite` has 30 RPM.
- **No persistence** — refresh = empty state.

## With another 4 hours

1. **Image thumbnails per car** — one hero shot, lazy-loaded. The single biggest decision-driver buyers actually use.
2. **Add `make` + `transmission` to the tool schema** — closes the two filter gaps above.
3. **Share-a-shortlist URL** — encode the compare list + chat into a URL param. Powerful for buyers showing their family.
4. **Voice input** — Web Speech API. *"Tell me what you want"* maps perfectly to speaking.
5. **Eval harness** — 20 synthetic user briefs with golden top-3 cars. Run on every system-prompt or scoring change. Would catch regressions any future-me introduces.
6. **Mobile compare polish** — the sheet works but the 3-column grid is cramped on phones; would switch to a swipe-between-cars carousel.

---

_Built with Cursor (composer-2.5-fast). AI provider in production: Gemini 2.5 Flash-Lite. Repo: `github.com/your-handle/car-concierge`._
