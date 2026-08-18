"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterSidebar } from "./filter-sidebar";

// Mobile-only filter panel. The Sheet is controlled so the panel closes as soon
// as a filter is selected (or "Clear all" is pressed) — otherwise the results
// update behind the open sheet and the user has to dismiss it manually.
export function MobileFilterSheet({ searchParams }: { searchParams: URLSearchParams }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <FilterSidebar searchParams={searchParams} onClose={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
