import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { HONEYPOT_FIELD } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Spam protection for public forms (contact, submit-scholarship).
//
// Two layers, both cheap and dependency-free:
//   1. Honeypot — a visually-hidden field that only bots fill. The form
//      renders it hidden (CSS + aria-hidden + tabIndex -1 + autocomplete off);
//      the server action calls `isHoneypotHit(formData)` FIRST and, when it's
//      filled, returns a fake success WITHOUT processing anything — bots can't
//      tell they were caught, so they never learn which field to leave empty.
//   2. IP rate limiting — each accepted submission is recorded in the
//      RateLimitEntry table (action + client IP + timestamp); when a single IP
//      exceeds `limit` submissions within `windowMs`, the action is refused
//      with a generic error. Old rows are pruned opportunistically on each
//      write so the table stays tiny.
// ---------------------------------------------------------------------------

// action -> { limit, windowMs }
const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  contact: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 / hour / IP
  "submit-scholarship": { limit: 2, windowMs: 60 * 60 * 1000 }, // 2 / hour / IP
  signin: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts / 15 min / IP (brute-force guard)
  signup: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 accounts / hour / IP
};

const DEFAULT_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

/** True when the honeypot field was filled (bot) — drop the submission silently. */
export function isHoneypotHit(formData: FormData): boolean {
  const v = String(formData.get(HONEYPOT_FIELD) ?? "").trim();
  return v.length > 0;
}

/** Client IP from x-forwarded-for (Vercel sets it); "unknown" when absent. */
async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
    const real = h.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  } catch {
    // headers() throws outside a request context (build-time prerender)
  }
  return "unknown";
}

/**
 * Records this submission attempt and returns an error message when the IP is
 * over the limit, or null when the submission may proceed. Call AFTER the
 * honeypot check and BEFORE any real work.
 */
export async function rateLimitError(action: string): Promise<string | null> {
  const { limit, windowMs } = LIMITS[action] ?? DEFAULT_LIMIT;
  const ip = await clientIp();
  const since = new Date(Date.now() - windowMs);

  try {
    const recent = await prisma.rateLimitEntry.count({
      where: { action, ip, createdAt: { gte: since } },
    });
    if (recent >= limit) {
      return "You've sent too many submissions recently. Please wait a while and try again.";
    }
    // Prune rows older than the window (opportunistic, keeps the table small)
    await prisma.rateLimitEntry.deleteMany({
      where: { action, createdAt: { lt: since } },
    });
    await prisma.rateLimitEntry.create({ data: { action, ip } });
  } catch {
    // Rate limiting must never block legitimate submissions if the DB hiccups.
    return null;
  }

  return null;
}
