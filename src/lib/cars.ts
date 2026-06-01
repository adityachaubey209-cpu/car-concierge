import carsData from "./data/cars.json";
import type { Car } from "./types";

const cars = carsData as Car[];

export function getAllCars(): Car[] {
  return cars;
}

export function getCarById(id: string): Car | undefined {
  return cars.find((car) => car.id === id);
}

export function getCarsByIds(ids: string[]): Car[] {
  const set = new Set(ids);
  return cars.filter((car) => set.has(car.id));
}

/**
 * Compact representation passed to the LLM. We strip fields the model
 * doesn't need to reason about (e.g. duplicate price min/max for entry-level)
 * to keep tokens low. Tweak as the prompt evolves.
 */
export function getCarsForLLM() {
  return cars.map((car) => ({
    id: car.id,
    name: `${car.make} ${car.model}`,
    bodyType: car.bodyType,
    priceLakhs: car.price,
    fuel: car.fuelTypes,
    transmissions: car.transmissions,
    seats: car.seatingCapacity,
    mileageKmpl: car.mileageKmpl,
    evRangeKm: car.evRangeKm,
    powerBhp: car.powerBhp,
    safetyRating: car.safetyRating,
    bestFor: car.bestFor,
    pros: car.pros,
    cons: car.cons,
    summary: car.summary,
  }));
}
