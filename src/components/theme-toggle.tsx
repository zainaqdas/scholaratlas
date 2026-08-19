"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// The theme lives in the <html> class (set by the inline script in layout.tsx
// before hydration). useSyncExternalStore reads it without an effect, so the
// button always reflects the applied theme and there's no setState-in-effect.
const THEME_EVENT = "sa-theme-change";

function getDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getDark, () => false);

  function toggle() {
    const next = !getDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("sa-theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
