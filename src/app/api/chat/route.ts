import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { getAllCars } from "@/lib/cars";
import type { ShortlistInput, ShortlistResult } from "@/lib/chat-types";
import type { BuyerTag, Car } from "@/lib/types";

export const maxDuration = 60;

// flash-lite has 3x the free-tier RPM of flash AND no built-in "thinking"
// tokens — perfect for our task (parse free text → call tool → write recap).
// Override via GEMINI_MODEL env var if you want gemini-2.5-flash / pro.
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

/** Google Generative AI (Gemini) provider. Free tier available via AI Studio. */
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `You are Car Concierge — a friendly, no-nonsense buying assistant for the Indian car market. You help confused buyers narrow down to a confident 3–5 car shortlist.

How you work:
1. The user describes their situation in free text. If you have enough signal (a budget AND at least one of: body type, seats, fuel, primary use), call the \`shortlistCars\` tool immediately.
2. If their brief is too vague (e.g. "I want a car"), ask ONE focused follow-up question. Across the whole conversation, never ask more than three questions total.
3. When calling \`shortlistCars\`, translate the user's words into concrete filters: budget → \`maxPriceLakhs\`, family size → \`minSeats\`, "SUV"/"hatchback"/etc → \`bodyTypes\`, fuel preference → \`fuelTypes\`, "safety matters" → \`mustHaveSafety: true\`. Always pass the user's situation as \`preferredUseCase\` (keep it short, 1 sentence).
4. After the tool returns, write a tight friendly recap. For each car, 1–2 sentences max on why it fits THIS user — reference their stated needs explicitly. No marketing copy. No exhaustive spec lists.
5. For follow-ups ("show cheaper", "what about hybrids?", "compare Creta and Seltos") — call the tool again with updated criteria, or answer directly if it's a pure knowledge question about cars already shown.

Hard rules:
- Prices are in INR lakhs (Indian rupees, 1 lakh = 100,000). Don't convert.
- ONLY recommend cars returned by the tool. Never invent variants, prices, or models.
- Be direct: "This one fits you because…" beats "This car offers…".
- One follow-up question per turn maximum. Never interrogate.
- If the user explicitly says "surprise me" or "I don't know", call the tool with a balanced default (₹15L budget, no body filter, preferredUseCase: "general first-time buyer guidance").`;

/**
 * Free-text → BuyerTag keyword mapping. Order matters only for readability;
 * each keyword adds its tags independently.
 */
const USE_CASE_KEYWORDS: ReadonlyArray<{ keyword: RegExp; tags: BuyerTag[] }> = [
  { keyword: /\bfamily\b/i, tags: ["young-family", "large-family"] },
  { keyword: /\b(city|urban|traffic|commute|office)\b/i, tags: ["city-commute"] },
  { keyword: /\b(highway|interstate|long\s*drive)\b/i, tags: ["highway-cruiser", "long-distance"] },
  { keyword: /\b(mileage|fuel\s*efficien|economy|kmpl)\b/i, tags: ["fuel-economy"] },
  { keyword: /\b(safe|safety|crash|ncap)\b/i, tags: ["safety-first"] },
  { keyword: /\b(off[-\s]?road|adventure|trail|jeep|thar)\b/i, tags: ["off-road-enthusiast"] },
  { keyword: /\b(premium|luxury|posh|upscale|fancy)\b/i, tags: ["premium-feel"] },
  { keyword: /\b(comfort|smooth|plush|relaxed)\b/i, tags: ["ride-comfort"] },
  { keyword: /\b(fast|performance|powerful|fun\s*to\s*drive|sporty)\b/i, tags: ["performance"] },
  { keyword: /\b(first\s*car|first[-\s]?time|beginner|new\s*driver)\b/i, tags: ["first-time-buyer"] },
  { keyword: /\b(budget|cheap|affordable|low\s*cost)\b/i, tags: ["budget-conscious"] },
  { keyword: /\b(ev|electric)\b/i, tags: ["eco-conscious"] },
  { keyword: /\b(hybrid)\b/i, tags: ["eco-conscious", "fuel-economy"] },
  { keyword: /\b(senior|elder|parent|grandparent)\b/i, tags: ["senior-friendly"] },
  { keyword: /\b(small\s*family|couple|just\s*two)\b/i, tags: ["small-family"] },
  { keyword: /\b(road\s*trip|trips?|outstation)\b/i, tags: ["long-distance"] },
];

function inferTagsFromUseCase(useCase: string): Set<BuyerTag> {
  const matches = new Set<BuyerTag>();
  for (const { keyword, tags } of USE_CASE_KEYWORDS) {
    if (keyword.test(useCase)) {
      tags.forEach((t) => matches.add(t));
    }
  }
  return matches;
}

const HUMAN_TAG_LABEL: Record<BuyerTag, string> = {
  "first-time-buyer": "first-time buyers",
  "young-family": "young families",
  "large-family": "large families (6+ people)",
  "city-commute": "city commuting",
  "long-distance": "long-distance trips",
  "highway-cruiser": "highway cruising",
  "off-road-enthusiast": "off-road use",
  "eco-conscious": "eco-conscious buyers",
  "budget-conscious": "tight budgets",
  "safety-first": "safety-first buyers",
  "fuel-economy": "fuel efficiency",
  "premium-feel": "a premium feel",
  "ride-comfort": "ride comfort",
  performance: "performance and driving fun",
  "small-family": "small families/couples",
  "senior-friendly": "easy ingress for seniors",
};

const shortlistInputSchema = z.object({
  maxPriceLakhs: z
    .number()
    .positive()
    .optional()
    .describe("Hard upper bound on ex-showroom price in INR lakhs. Use the car's MIN variant price for filtering."),
  minSeats: z
    .number()
    .int()
    .min(2)
    .max(9)
    .optional()
    .describe("Minimum seating capacity required."),
  bodyTypes: z
    .array(
      z.enum(["Hatchback", "Sedan", "Compact SUV", "SUV", "MPV", "Coupe SUV"]),
    )
    .optional()
    .describe("Restrict to these body types. Omit or empty array means any."),
  fuelTypes: z
    .array(
      z.enum(["Petrol", "Diesel", "CNG", "Electric", "Hybrid", "Mild Hybrid"]),
    )
    .optional()
    .describe("Restrict to cars offering at least one of these fuel types."),
  mustHaveSafety: z
    .boolean()
    .optional()
    .describe("If true, only include cars with safety rating >= 4 stars."),
  preferredUseCase: z
    .string()
    .describe(
      "Short free-text description of how the buyer will use the car (e.g. 'family of 4, mostly city, occasional highway trips'). Used for scoring.",
    ),
  topN: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(5)
    .describe("How many cars to return in the shortlist. Default 5."),
});

// Sanity check: the zod-inferred input type should match the shared contract.
type _AssertInputShape = ShortlistInput extends z.infer<typeof shortlistInputSchema>
  ? z.infer<typeof shortlistInputSchema> extends ShortlistInput
    ? true
    : never
  : never;
const _inputShapeOk: _AssertInputShape = true;
void _inputShapeOk;

function applyHardFilters(cars: Car[], input: ShortlistInput): Car[] {
  return cars.filter((car) => {
    if (input.maxPriceLakhs !== undefined && car.price.min > input.maxPriceLakhs) {
      return false;
    }
    if (input.minSeats !== undefined && car.seatingCapacity.max < input.minSeats) {
      return false;
    }
    if (input.bodyTypes && input.bodyTypes.length > 0 && !input.bodyTypes.includes(car.bodyType)) {
      return false;
    }
    if (input.fuelTypes && input.fuelTypes.length > 0) {
      const overlap = car.fuelTypes.some((f) => input.fuelTypes!.includes(f));
      if (!overlap) return false;
    }
    if (input.mustHaveSafety && car.safetyRating < 4) {
      return false;
    }
    return true;
  });
}

function scoreCars(
  cars: Car[],
  matchedTags: Set<BuyerTag>,
): Array<{ car: Car; score: number; reasons: string[] }> {
  if (cars.length === 0) return [];

  const sortedByPrice = [...cars].sort((a, b) => a.price.min - b.price.min);
  const valueCutoffIndex = Math.ceil(sortedByPrice.length * 0.6) - 1;
  const valueCutoffPrice = sortedByPrice[Math.max(valueCutoffIndex, 0)].price.min;

  return cars.map((car) => {
    let score = 0;
    const reasons: string[] = [];

    const overlap = car.bestFor.filter((t) => matchedTags.has(t));
    if (overlap.length > 0) {
      score += overlap.length * 2;
      const labels = overlap
        .slice(0, 2)
        .map((t) => HUMAN_TAG_LABEL[t])
        .join(" and ");
      reasons.push(`Built for ${labels}`);
    }

    if (car.safetyRating >= 4) {
      score += 1;
      reasons.push(`${car.safetyRating}-star NCAP safety`);
    }

    if (car.price.min <= valueCutoffPrice) {
      score += 1;
      reasons.push(
        `Strong value at ₹${car.price.min.toFixed(1)}–${car.price.max.toFixed(1)} L`,
      );
    }

    return { car, score, reasons };
  });
}

function selectTopN(
  scored: Array<{ car: Car; score: number; reasons: string[] }>,
  topN: number,
): Array<{ car: Car; score: number; reasons: string[] }> {
  return [...scored]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: prefer cheaper, then higher safety
      if (a.car.price.min !== b.car.price.min) return a.car.price.min - b.car.price.min;
      return b.car.safetyRating - a.car.safetyRating;
    })
    .slice(0, topN);
}

function runShortlistTool(input: ShortlistInput): ShortlistResult {
  const all = getAllCars();
  const filtered = applyHardFilters(all, input);
  const matchedTags = inferTagsFromUseCase(input.preferredUseCase);
  const scored = scoreCars(filtered, matchedTags);
  const top = selectTopN(scored, input.topN);

  return {
    appliedFilters: {
      maxPriceLakhs: input.maxPriceLakhs,
      minSeats: input.minSeats,
      bodyTypes: input.bodyTypes,
      fuelTypes: input.fuelTypes,
      mustHaveSafety: input.mustHaveSafety,
    },
    totalConsidered: all.length,
    totalAfterFiltering: filtered.length,
    cars: top.map(({ car, score, reasons }) => ({
      id: car.id,
      name: `${car.make} ${car.model}`,
      priceRange: car.price,
      summary: car.summary,
      matchScore: score,
      matchReasons: reasons.length > 0 ? reasons : [car.summary],
    })),
  };
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google(process.env.GEMINI_MODEL ?? DEFAULT_MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 2048,
    stopWhen: stepCountIs(4),
    providerOptions: {
      google: {
        // Disable thinking tokens. flash-lite doesn't think anyway; for flash
        // / pro overrides, this skips needless reasoning for a task that
        // doesn't benefit from it.
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    tools: {
      shortlistCars: {
        description:
          "Filter and rank the catalog of Indian cars to produce a 3–5 car shortlist tailored to the buyer's situation. Call this once you have a budget and at least one other signal (body type, seats, fuel, or use case).",
        inputSchema: shortlistInputSchema,
        execute: async (input) => runShortlistTool(input),
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
