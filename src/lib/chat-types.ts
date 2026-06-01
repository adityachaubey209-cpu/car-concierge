/**
 * Shared shapes between the `/api/chat` route and the chat UI.
 * These define the contract for the `shortlistCars` tool's I/O.
 */

import type { BodyType, FuelType } from "./types";

export interface ShortlistInput {
  maxPriceLakhs?: number;
  minSeats?: number;
  bodyTypes?: BodyType[];
  fuelTypes?: FuelType[];
  mustHaveSafety?: boolean;
  preferredUseCase: string;
  topN: number;
}

export interface ShortlistResultCar {
  id: string;
  name: string;
  priceRange: { min: number; max: number };
  summary: string;
  matchScore: number;
  matchReasons: string[];
}

export interface ShortlistResult {
  appliedFilters: {
    maxPriceLakhs?: number;
    minSeats?: number;
    bodyTypes?: string[];
    fuelTypes?: string[];
    mustHaveSafety?: boolean;
  };
  totalConsidered: number;
  totalAfterFiltering: number;
  cars: ShortlistResultCar[];
}
