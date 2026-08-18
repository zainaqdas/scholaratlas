"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "sa-compare";

export function CompareTray() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function update() {
      try {
        setCount(JSON.parse(localStorage.getItem(KEY) ?? "[]").length);
      } catch {
        setCount(0);
      }
    }
    update();
    window.addEventListener("sa-compare-change", update);
    return () => window.removeEventListener("sa-compare-change", update);
  }, []);

  if (count < 2) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-4 py-2.5 shadow-xl">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Columns3 className="h-4 w-4 text-brand-indigo dark:text-indigo-300" />
        {count} selected
      </span>
      <Button asChild size="sm" className="gap-1.5">
        <Link href="/compare">
          Compare
        </Link>
      </Button>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(KEY, "[]");
          window.dispatchEvent(new Event("sa-compare-change"));
        }}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Clear comparison"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
