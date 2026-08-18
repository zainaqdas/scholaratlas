// Helpers for working with Scholarship records. JSON-stringified array fields on
// the model are parsed here; UI code should use these helpers rather than
// touching raw strings.

import type { Scholarship } from "@prisma/client";
import { studyLevelFromSlug } from "./constants";
import { daysUntil, isExpired } from "./format";

export function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const studyLevelsOf = (s: Scholarship): string[] => parseJSON<string[]>(s.studyLevels, []);
export const studyLevelNamesOf = (s: Scholarship): string[] =>
  studyLevelsOf(s).map((slug) => studyLevelFromSlug(slug) ?? slug);
export const fieldsOf = (s: Scholarship): string[] => parseJSON<string[]>(s.fields, []);
export const benefitsOf = (s: Scholarship): string[] => parseJSON<string[]>(s.benefits, []);
export const docsOf = (s: Scholarship): string[] => parseJSON<string[]>(s.requiredDocuments, []);
export const stepsOf = (s: Scholarship): string[] | null => {
  const steps = parseJSON<string[]>(s.applicationSteps, []);
  return steps.length ? steps : null;
};
export const hostCountriesOf = (s: Scholarship): string[] =>
  parseJSON<string[]>(s.hostCountries, []);

export const eligibleOf = (s: Scholarship): string[] => {
  // Guard against legacy/malformed values (e.g. prose stored instead of a
  // JSON array) — never let a non-array reach UI code that calls .map().
  const v: unknown = parseJSON<unknown>(s.eligibleNationalities, ["ALL"]);
  return Array.isArray(v) ? (v as string[]) : [];
};
export const isOpenToAll = (s: Scholarship): boolean => eligibleOf(s).includes("ALL");

export interface LanguageReq {
  ielts: boolean;
  toefl: boolean;
  noIelts: boolean;
  altProof: boolean;
  notRequired: boolean;
}

export const languageOf = (s: Scholarship): LanguageReq => ({
  ielts: false,
  toefl: false,
  noIelts: false,
  altProof: false,
  notRequired: false,
  ...parseJSON<Partial<LanguageReq>>(s.languageRequirements, {}),
});

export const hasNoIelts = (s: Scholarship): boolean => {
  const l = languageOf(s);
  return l.noIelts || l.notRequired || l.altProof;
};

export const hasField = (s: Scholarship, slug: string): boolean => {
  const fields = fieldsOf(s);
  return fields.includes("ALL") || fields.includes(slug);
};

export const hasLevel = (s: Scholarship, slug: string): boolean => {
  const levels = studyLevelsOf(s);
  return levels.includes("ALL") || levels.includes(slug);
};

export const isNationalityEligible = (s: Scholarship, nationalityCode?: string | null): boolean => {
  if (isOpenToAll(s)) return true;
  if (!nationalityCode) return false;
  return eligibleOf(s).includes(nationalityCode.toUpperCase());
};

// --- Deadline states --------------------------------------------------------

export type DeadlineState = "closed" | "urgent" | "soon" | "ok" | "open" | "none";

export function deadlineState(s: Scholarship): DeadlineState {
  if (isExpired(s.deadline)) return "closed";
  if (!s.deadline) return "none";
  const days = daysUntil(s.deadline) ?? 999;
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "ok";
}

export function deadlineStateLabel(state: DeadlineState): string {
  switch (state) {
    case "closed":
      return "Closed";
    case "urgent":
      return "Closing soon";
    case "soon":
      return "Deadline approaching";
    case "ok":
      return "Plenty of time";
    case "open":
      return "Open applications";
    case "none":
      return "Open / rolling";
  }
}

export function deadlineDaysLabel(s: Scholarship): string {
  if (!s.deadline) return "Open / rolling";
  const days = daysUntil(s.deadline);
  if (days === null) return "Not specified";
  if (days < 0) return "Closed";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days left`;
}

export function deadlineToneClass(state: DeadlineState): string {
  switch (state) {
    case "closed":
      return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900";
    case "urgent":
      return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900";
    case "soon":
      return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900";
    case "ok":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  }
}

// --- Matching (used for "Scholarships For You" and the AI assistant) --------

export interface MatchReasons {
  score: number; // 0–100
  reasons: string[];
  missing: string[];
}

export interface StudentProfile {
  nationality?: string | null;
  degreeLevel?: string | null; // study level slug
  fieldOfStudy?: string | null; // field slug
  preferredDestination?: string | null; // country code
}

const COUNTRY_REASONS: Record<string, string> = {
  PK: "Your nationality is eligible",
  IN: "Your nationality is eligible",
  BD: "Your nationality is eligible",
  NG: "Your nationality is eligible",
  KE: "Your nationality is eligible",
  EG: "Your nationality is eligible",
  GH: "Your nationality is eligible",
  VN: "Your nationality is eligible",
  ID: "Your nationality is eligible",
  PH: "Your nationality is eligible",
  ZA: "Your nationality is eligible",
  BR: "Your nationality is eligible",
  MX: "Your nationality is eligible",
};

export function matchScholarship(s: Scholarship, profile: StudentProfile): MatchReasons {
  const reasons: string[] = [];
  const missing: string[] = [];
  let score = 40; // baseline

  // Nationality
  if (profile.nationality) {
    if (isOpenToAll(s) || eligibleOf(s).includes(profile.nationality.toUpperCase())) {
      reasons.push("Your nationality is eligible");
      score += 20;
    } else {
      missing.push("Your nationality may not be eligible");
    }
  }

  // Degree level
  if (profile.degreeLevel) {
    if (hasLevel(s, profile.degreeLevel)) {
      reasons.push("Your study level matches");
      score += 20;
    } else {
      missing.push("Study level does not clearly match");
    }
  }

  // Field
  if (profile.fieldOfStudy) {
    if (hasField(s, profile.fieldOfStudy)) {
      reasons.push("Your field matches");
      score += 20;
    } else {
      missing.push("Field does not clearly match");
    }
  }

  // Destination
  if (profile.preferredDestination) {
    if (s.countryCode === profile.preferredDestination.toUpperCase()) {
      reasons.push("Your preferred destination matches");
      score += 20;
    } else {
      missing.push("Different destination country");
    }
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons,
    missing,
  };
}

export const COUNTRY_ELIGIBILITY_REASON = COUNTRY_REASONS;
