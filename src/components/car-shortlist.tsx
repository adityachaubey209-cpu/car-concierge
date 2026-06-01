"use client";

import { Check, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ShortlistResultCar } from "@/lib/chat-types";

interface CarShortlistProps {
  cars: ShortlistResultCar[];
  /** Optional handler — wired in Phase 4 (compare sheet). */
  onCompare?: (carId: string) => void;
  comparedIds?: ReadonlySet<string>;
}

function formatPriceRange(min: number, max: number): string {
  return `₹${min.toFixed(1)} – ₹${max.toFixed(1)} L`;
}

export function CarShortlist({ cars, onCompare, comparedIds }: CarShortlistProps) {
  if (cars.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No cars matched these filters. Try widening your budget or relaxing other criteria.
      </div>
    );
  }

  return (
    <div className="-mx-1 flex flex-col gap-3 px-1 md:flex-row md:overflow-x-auto md:pb-2">
      {cars.map((car) => {
        const isCompared = comparedIds?.has(car.id) ?? false;
        return (
          <Card
            key={car.id}
            className="relative flex flex-col md:w-72 md:shrink-0"
          >
            <CardHeader className="space-y-1 pb-3 pt-9">
              <Badge
                variant="secondary"
                className="absolute left-3 top-3 text-[10px] font-medium uppercase tracking-wide"
              >
                Match · {car.matchScore}
              </Badge>
              {onCompare && (
                <Button
                  variant={isCompared ? "default" : "ghost"}
                  size="sm"
                  className="absolute right-2 top-2 h-7 px-2 text-xs"
                  onClick={() => onCompare(car.id)}
                  aria-pressed={isCompared}
                >
                  <Scale className="mr-1 h-3 w-3" />
                  {isCompared ? "Added" : "Compare"}
                </Button>
              )}
              <div className="text-sm font-semibold leading-tight">
                {car.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatPriceRange(car.priceRange.min, car.priceRange.max)}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 pt-0">
              <p className="text-xs italic leading-relaxed text-muted-foreground">
                {car.summary}
              </p>
              <ul className="space-y-1.5">
                {car.matchReasons.slice(0, 3).map((reason, i) => (
                  <li
                    key={`${car.id}-reason-${i}`}
                    className="flex items-start gap-2 text-xs leading-snug"
                  >
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
