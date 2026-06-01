"use client";

import { Minus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCarsByIds } from "@/lib/cars";
import type { Car } from "@/lib/types";

interface CompareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carIds: string[];
  onRemove: (carId: string) => void;
  onClear: () => void;
}

export function CompareSheet({
  open,
  onOpenChange,
  carIds,
  onRemove,
  onClear,
}: CompareSheetProps) {
  // Preserve the order the user added cars in.
  const carById = new Map(getCarsByIds(carIds).map((car) => [car.id, car]));
  const cars: Car[] = carIds
    .map((id) => carById.get(id))
    .filter((c): c is Car => Boolean(c));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div>
              <SheetTitle>Side-by-side comparison</SheetTitle>
              <SheetDescription>
                {cars.length === 0
                  ? "Add cars from the shortlist to compare."
                  : `Comparing ${cars.length} ${
                      cars.length === 1 ? "car" : "cars"
                    } (max 3).`}
              </SheetDescription>
            </div>
            {cars.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        </SheetHeader>

        {cars.length === 0 ? (
          <EmptyCompare />
        ) : (
          <div className="flex-1 overflow-auto px-6 py-4">
            <ComparisonGrid cars={cars} onRemove={onRemove} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EmptyCompare() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Click <kbd className="rounded border bg-muted px-1 text-xs">Compare</kbd>{" "}
        on any car in a shortlist to add it here.
      </p>
    </div>
  );
}

interface ComparisonGridProps {
  cars: Car[];
  onRemove: (carId: string) => void;
}

function ComparisonGrid({ cars, onRemove }: ComparisonGridProps) {
  const rows: Array<{
    label: string;
    render: (car: Car) => React.ReactNode;
  }> = [
    {
      label: "Price",
      render: (car) => (
        <span className="font-medium">
          ₹{car.price.min.toFixed(1)} – ₹{car.price.max.toFixed(1)} L
        </span>
      ),
    },
    {
      label: "Body type",
      render: (car) => car.bodyType,
    },
    {
      label: "Seats",
      render: (car) =>
        car.seatingCapacity.min === car.seatingCapacity.max
          ? `${car.seatingCapacity.min}`
          : `${car.seatingCapacity.min}–${car.seatingCapacity.max}`,
    },
    {
      label: "Fuel",
      render: (car) => (
        <div className="flex flex-wrap gap-1">
          {car.fuelTypes.map((fuel) => (
            <Badge key={fuel} variant="outline" className="text-[10px]">
              {fuel}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      label: "Mileage / range",
      render: (car) => {
        if (car.evRangeKm) {
          return `${car.evRangeKm.min}–${car.evRangeKm.max} km range`;
        }
        if (car.mileageKmpl) {
          return `${car.mileageKmpl.min}–${car.mileageKmpl.max} kmpl`;
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      label: "Power",
      render: (car) =>
        car.powerBhp.min === car.powerBhp.max
          ? `${car.powerBhp.min} bhp`
          : `${car.powerBhp.min}–${car.powerBhp.max} bhp`,
    },
    {
      label: "Safety",
      render: (car) =>
        car.safetyRating > 0 ? (
          <span>
            {"★".repeat(car.safetyRating)}
            <span className="text-muted-foreground">
              {"★".repeat(5 - car.safetyRating)}
            </span>
            <span className="ml-1 text-[10px] text-muted-foreground">
              NCAP
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Not rated</span>
        ),
    },
    {
      label: "Key pros",
      render: (car) => (
        <ul className="space-y-1">
          {car.pros.slice(0, 2).map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-xs">
              <span className="mt-0.5 text-emerald-500">+</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: "Key cons",
      render: (car) => (
        <ul className="space-y-1">
          {car.cons.slice(0, 2).map((c) => (
            <li key={c} className="flex items-start gap-1.5 text-xs">
              <Minus className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  // Compute column template: a fixed-width label column + one fr per car.
  const gridCols = `120px repeat(${cars.length}, minmax(200px, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-full"
        style={{ display: "grid", gridTemplateColumns: gridCols }}
      >
        {/* Header row: car name + remove button */}
        <div className="sticky left-0 z-10 bg-popover" />
        {cars.map((car) => (
          <div key={`hdr-${car.id}`} className="px-3 pb-3">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">
                  {car.make} {car.model}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {car.bodyType}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 h-6 w-6 shrink-0"
                onClick={() => onRemove(car.id)}
                aria-label={`Remove ${car.model}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {/* Spec rows */}
        {rows.map((row) => (
          <RowGroup
            key={row.label}
            label={row.label}
            cars={cars}
            render={row.render}
          />
        ))}
      </div>
    </div>
  );
}

interface RowGroupProps {
  label: string;
  cars: Car[];
  render: (car: Car) => React.ReactNode;
}

function RowGroup({ label, cars, render }: RowGroupProps) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-start border-t bg-popover px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {cars.map((car) => (
        <div
          key={`${label}-${car.id}`}
          className="border-t px-3 py-2.5 text-sm"
        >
          {render(car)}
        </div>
      ))}
    </>
  );
}
