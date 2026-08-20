"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sa-consent";

/**
 * GDPR-friendly consent banner. Shown until the visitor accepts or declines;
 * the choice is stored in localStorage. Advertising/analytics scripts only
 * load after explicit acceptance (see src/components/analytics.tsx), and the
 * banner's own state is a first-party preference — not a tracking cookie.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Deferred so the banner fades in a beat after load instead of flashing.
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
      } catch {
        // Private mode — banner is fine to show each visit.
        setVisible(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  function decide(choice: "accepted" | "declined") {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-5" role="region" aria-label="Cookie consent">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 sm:flex dark:bg-amber-500/15 dark:text-amber-300">
          <Cookie className="h-5 w-5" />
        </span>
        <div className="flex-1 text-sm leading-relaxed">
          <p className="font-semibold">We use cookies to keep the site running and, with your permission, to measure how it&apos;s used.</p>
          <p className="mt-1 text-muted-foreground">
            Essential cookies (sign-in, theme) are always on. Analytics and advertising cookies are only
            loaded if you accept — see our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-primary">
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide("declined")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => decide("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
