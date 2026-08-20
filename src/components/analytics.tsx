"use client";

import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = "sa-consent";

/**
 * Consent-gated analytics. Loads the Google Analytics 4 snippet only when:
 *   1. NEXT_PUBLIC_GA_ID is configured (set it in Vercel when you create your
 *      GA4 property — leave unset to ship with zero third-party scripts), and
 *   2. the visitor accepted the cookie-consent banner (localStorage
 *      "sa-consent" === "accepted").
 */
export function Analytics() {
  useEffect(() => {
    if (!GA_ID) return;
    let consented = false;
    try {
      consented = localStorage.getItem(CONSENT_KEY) === "accepted";
    } catch {}
    if (!consented) return;

    const win = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    win.dataLayer = win.dataLayer || [];
    win.gtag = function gtag(...args: unknown[]) {
      win.dataLayer!.push(args);
    };
    win.gtag("js", new Date());
    win.gtag("config", GA_ID);

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
  }, []);

  return null;
}
