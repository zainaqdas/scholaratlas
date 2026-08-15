import {
  COUNTRIES,
  FIELDS,
  FUNDING_TYPES,
  LANGUAGE_LABELS,
  PROVIDER_TYPES,
  STUDY_LEVELS,
  studyLevelSlug,
} from "@/lib/constants";

export { COUNTRIES, FIELDS, FUNDING_TYPES, PROVIDER_TYPES, STUDY_LEVELS };

export const STUDY_LEVELS_EXPORT = STUDY_LEVELS;

export const DEADLINE_OPTIONS = [
  { value: "closing-soon", label: "Closing Soon" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "next-3-months", label: "Next 3 Months" },
  { value: "open", label: "Open Applications" },
  { value: "upcoming", label: "Upcoming" },
];

export const FIELD_OPTIONS = FIELDS.map((f) => ({ value: f.slug, label: f.name }));

export const LANGUAGE_OPTIONS = [
  { value: "ielts", label: LANGUAGE_LABELS.IELTS },
  { value: "toefl", label: LANGUAGE_LABELS.TOEFL },
  { value: "no-ielts", label: LANGUAGE_LABELS.NO_IELTS },
  { value: "alt-proof", label: LANGUAGE_LABELS.ALTERNATIVE_PROOF },
  { value: "not-required", label: LANGUAGE_LABELS.NOT_REQUIRED },
];

export { studyLevelSlug };
