// Shared duplicate-detection helpers.
//
// Used by both the offline `scripts/dedupe.ts` cleanup pass and the admin
// dashboard's "Potential Duplicates" panel, so the two always agree on what
// counts as a duplicate.

/** Lowercase + collapse punctuation/whitespace so "Master's" and "masters" match. */
export const normalizeText = (s: string): string =>
  (s || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/** Exact-duplicate key: normalized title + provider + destination country. */
export const duplicateKey = (
  title: string,
  provider: string,
  countryCode: string | null
): string => `${normalizeText(title)}|${normalizeText(provider)}|${countryCode ?? ""}`;

export interface DuplicateRow {
  id: string;
  slug: string;
  title: string;
  provider: string;
  countryCode: string | null;
  officialUrl: string | null;
  deadline: Date | null;
  status: string;
  updatedAt: Date;
}

/** When duplicates collide, keep the richest record (ACTIVE + URL + deadline). */
export function richnessScore(r: Pick<DuplicateRow, "status" | "officialUrl" | "deadline">): number {
  let n = 0;
  if (r.status === "ACTIVE") n += 4;
  if (r.officialUrl) n += 2;
  if (r.deadline) n += 2;
  return n;
}
