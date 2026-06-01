export type BodyType =
  | "Hatchback"
  | "Sedan"
  | "Compact SUV"
  | "SUV"
  | "MPV"
  | "Coupe SUV";

export type FuelType =
  | "Petrol"
  | "Diesel"
  | "CNG"
  | "Electric"
  | "Hybrid"
  | "Mild Hybrid";

export type Transmission = "Manual" | "Automatic" | "AMT" | "CVT" | "DCT" | "iMT";

/**
 * Informal buyer archetype tags. The AI uses these to match a user's
 * described situation to cars. Keep this list small & opinionated.
 */
export type BuyerTag =
  | "first-time-buyer"
  | "young-family"
  | "large-family"
  | "city-commute"
  | "long-distance"
  | "highway-cruiser"
  | "off-road-enthusiast"
  | "eco-conscious"
  | "budget-conscious"
  | "safety-first"
  | "fuel-economy"
  | "premium-feel"
  | "ride-comfort"
  | "performance"
  | "small-family"
  | "senior-friendly";

export interface Car {
  /** kebab-case unique slug, e.g. "maruti-swift" */
  id: string;
  make: string;
  model: string;
  bodyType: BodyType;
  /** Indicative ex-showroom price range in INR lakhs across variants. */
  price: { min: number; max: number };
  fuelTypes: FuelType[];
  transmissions: Transmission[];
  /** Min and max seats across variants. Single-seat cars repeat the number. */
  seatingCapacity: { min: number; max: number };
  /** ARAI / claimed efficiency. For EVs, this is km of range per full charge. */
  mileageKmpl?: { min: number; max: number };
  evRangeKm?: { min: number; max: number };
  engine: string;
  powerBhp: { min: number; max: number };
  /** Global NCAP or Bharat NCAP star rating for adult occupant. 0 = not rated. */
  safetyRating: number;
  keyFeatures: string[];
  pros: string[];
  cons: string[];
  bestFor: BuyerTag[];
  /** One-line marketing-style summary the UI can show as a tagline. */
  summary: string;
}
