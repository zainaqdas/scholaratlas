// ---------------------------------------------------------------------------
// Renew-in-place for re-crawled sources.
//
// Scholarships are annual cycles: a record that expired (deadline passed) is
// not dead forever — when the source reopens it next cycle, the re-crawl
// should bring it BACK to the catalogue instead of skipping it as a
// "duplicate" (which is what the old importers did: they matched by sourceUrl
// and threw the new cycle's data away).
//
// This module decides what a fresh crawl row does to an existing record
// matched by sourceUrl, and applies the writes.
// ---------------------------------------------------------------------------

import { prisma } from "../../src/lib/prisma";

export interface ExistingLite {
  id: string;
  // slug/title/provider are not used by the decision — kept optional so
  // importers can run a lean select (id, sourceUrl, status, deadline).
  slug?: string;
  sourceUrl?: string | null;
  title?: string | null;
  provider?: string | null;
  status: string;
  deadline: Date | null;
}

export type RenewalDecision =
  | { kind: "renew"; id: string; data: Record<string, any> }
  | { kind: "update-deadline"; id: string; deadline: Date }
  | { kind: "skip" };

/**
 * Decide what a fresh crawl row should do to the existing record that shares
 * its sourceUrl:
 *
 * - existing EXPIRED + fresh row has a future deadline (reopened cycle) OR no
 *   deadline (the source still lists it as open)  -> RENEW in place: every
 *   mapped field is refreshed, status flips ACTIVE. The same id + slug are
 *   kept, so the page's SEO authority and any "verified" stamp carry over.
 * - existing ACTIVE + fresh row has a different future deadline
 *   -> just correct the deadline (mid-cycle source update).
 * - everything else (mid-cycle duplicate, stale page still showing last
 *   cycle's past deadline)                         -> skip.
 *
 * verificationStatus / lastVerifiedAt are preserved on renewal: re-crawling
 * the same official source does not downgrade an already-verified record.
 */
export function renewalDecision(existing: ExistingLite, row: Record<string, any>): RenewalDecision {
  const raw = row.deadline as Date | string | null | undefined;
  const newDeadline = raw ? new Date(raw) : null;
  const future = !!newDeadline && newDeadline.getTime() > Date.now();

  if (existing.status === "EXPIRED") {
    // Reopened with a future deadline, or still listed with no deadline.
    if (future || !newDeadline) {
      const { slug: _slug, verificationStatus: _vs, lastVerifiedAt: _lv, ...data } = row;
      return { kind: "renew", id: existing.id, data: { ...data, status: "ACTIVE" } };
    }
    return { kind: "skip" };
  }

  if (
    existing.status === "ACTIVE" &&
    future &&
    (!existing.deadline || newDeadline!.getTime() !== existing.deadline.getTime())
  ) {
    return { kind: "update-deadline", id: existing.id, deadline: newDeadline! };
  }
  return { kind: "skip" };
}

/** Apply renewals (full update) and deadline corrections; returns counts. */
export async function applyRenewals(
  renewals: { id: string; data: Record<string, any> }[],
  deadlineUpdates: { id: string; deadline: Date }[]
): Promise<{ renewed: number; deadlineUpdated: number }> {
  let renewed = 0;
  for (const r of renewals) {
    await prisma.scholarship.update({ where: { id: r.id }, data: r.data });
    renewed++;
  }
  let deadlineUpdated = 0;
  for (const d of deadlineUpdates) {
    await prisma.scholarship.update({ where: { id: d.id }, data: { deadline: d.deadline } });
    deadlineUpdated++;
  }
  return { renewed, deadlineUpdated };
}
