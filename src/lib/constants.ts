// ---------------------------------------------------------------------------
// ScholarAtlas — shared constants and lookup data.
// Single source of truth for enumerations, countries, fields, categories, etc.
// ---------------------------------------------------------------------------

export const APP_NAME = "ScholarAtlas";
export const TAGLINE = "Find Your Scholarship. Build Your Future.";
export const TAGLINE_ALT = "Your world of scholarships, in one place.";

// --- Study levels -----------------------------------------------------------
export type StudyLevel =
  | "High School"
  | "Undergraduate"
  | "Master's"
  | "MBA"
  | "PhD"
  | "Postdoctoral"
  | "Research"
  | "Short Course"
  | "Exchange Program";

export const STUDY_LEVELS: StudyLevel[] = [
  "High School",
  "Undergraduate",
  "Master's",
  "MBA",
  "PhD",
  "Postdoctoral",
  "Research",
  "Short Course",
  "Exchange Program",
];

export function studyLevelSlug(level: StudyLevel): string {
  // Special-case Master's so its slug is "masters" (the apostrophe would
  // otherwise produce "master-s"). Keep in sync with LEVEL_SLUG_ALIASES.
  if (level === "Master's") return "masters";
  return level.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Legacy/alternative slugs accepted when reading stored values.
const LEVEL_SLUG_ALIASES: Record<string, string> = {
  "master-s": "masters", // produced by the old slugger for "Master's"
  "master": "masters",
  "ms": "masters",
  "bachelors": "undergraduate",
  "bachelor": "undergraduate",
  "post-doc": "postdoctoral",
  "postdoc": "postdoctoral",
  "exchange": "exchange-program",
  "shortcourse": "short-course",
};

export function studyLevelFromSlug(slug: string): StudyLevel | undefined {
  const normalized = LEVEL_SLUG_ALIASES[slug.toLowerCase()] ?? slug.toLowerCase();
  return STUDY_LEVELS.find((l) => studyLevelSlug(l) === normalized);
}

// --- Funding types ----------------------------------------------------------
export type FundingType =
  | "FULLY_FUNDED"
  | "FULLY_FUNDED_STIPEND"
  | "TUITION_WAIVER"
  | "PARTIAL";

export const FUNDING_TYPES: { value: FundingType; label: string; short: string }[] = [
  { value: "FULLY_FUNDED", label: "Fully Funded", short: "Fully Funded" },
  { value: "FULLY_FUNDED_STIPEND", label: "Fully Funded + Stipend", short: "Full + Stipend" },
  { value: "TUITION_WAIVER", label: "Tuition Waiver", short: "Tuition Waiver" },
  { value: "PARTIAL", label: "Partial Funding", short: "Partial" },
];

export const fundingLabel = (v: string) =>
  FUNDING_TYPES.find((f) => f.value === v)?.label ?? v;

// --- Benefits ---------------------------------------------------------------
export type BenefitKey =
  | "tuition"
  | "stipend"
  | "accommodation"
  | "insurance"
  | "airfare"
  | "visaSupport"
  | "researchAllowance";

export const BENEFITS: { key: BenefitKey; label: string }[] = [
  { key: "tuition", label: "Full Tuition Fee" },
  { key: "stipend", label: "Monthly Stipend" },
  { key: "accommodation", label: "Accommodation" },
  { key: "insurance", label: "Health Insurance" },
  { key: "airfare", label: "Airfare" },
  { key: "visaSupport", label: "Visa Support" },
  { key: "researchAllowance", label: "Research Allowance" },
];

export const benefitLabel = (k: string) =>
  BENEFITS.find((b) => b.key === k)?.label ?? k;

// --- Required documents -----------------------------------------------------
export type DocumentKey =
  | "passport"
  | "transcripts"
  | "cv"
  | "motivationLetter"
  | "recommendationLetters"
  | "personalStatement"
  | "researchProposal"
  | "englishProof"
  | "portfolio"
  | "other";

export const DOCUMENTS: { key: DocumentKey; label: string }[] = [
  { key: "passport", label: "Passport" },
  { key: "transcripts", label: "Academic transcripts" },
  { key: "cv", label: "CV / Resume" },
  { key: "motivationLetter", label: "Motivation letter" },
  { key: "recommendationLetters", label: "Recommendation letters" },
  { key: "personalStatement", label: "Personal statement" },
  { key: "researchProposal", label: "Research proposal" },
  { key: "englishProof", label: "Proof of English proficiency" },
  { key: "portfolio", label: "Portfolio" },
  { key: "other", label: "Other documents" },
];

export const documentLabel = (k: string) =>
  DOCUMENTS.find((d) => d.key === k)?.label ?? k;

// --- Provider types ---------------------------------------------------------
export type ProviderType =
  | "GOVERNMENT"
  | "UNIVERSITY"
  | "NGO"
  | "FOUNDATION"
  | "PRIVATE"
  | "INTERNATIONAL_ORGANIZATION";

export const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: "GOVERNMENT", label: "Government" },
  { value: "UNIVERSITY", label: "University" },
  { value: "NGO", label: "NGO" },
  { value: "FOUNDATION", label: "Foundation" },
  { value: "PRIVATE", label: "Private Organization" },
  { value: "INTERNATIONAL_ORGANIZATION", label: "International Organization" },
];

export const providerTypeLabel = (v: string) =>
  PROVIDER_TYPES.find((p) => p.value === v)?.label ?? v;

// --- Verification status ----------------------------------------------------
export type VerificationStatus =
  | "VERIFIED"
  | "RECENTLY_UPDATED"
  | "DEADLINE_CONFIRMED"
  | "COMMUNITY_SUBMITTED"
  | "UNVERIFIED";

export const VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "Verified",
  RECENTLY_UPDATED: "Recently Updated",
  DEADLINE_CONFIRMED: "Deadline Confirmed",
  COMMUNITY_SUBMITTED: "Community Submitted",
  UNVERIFIED: "Unverified",
};

export const VERIFICATION_TONES: Record<string, "green" | "blue" | "amber" | "gray"> = {
  VERIFIED: "green",
  RECENTLY_UPDATED: "blue",
  DEADLINE_CONFIRMED: "green",
  COMMUNITY_SUBMITTED: "amber",
  UNVERIFIED: "gray",
};

// --- Record types -----------------------------------------------------------
// SCHOLARSHIP = funding/application opportunities in the catalogue.
// JOB = research positions / PhD vacancies / postdocs (e.g. EURAXESS) — kept
//       out of the scholarship UI, visible only via direct URL.
// CONTEST = competitions, prizes, contests (e.g. university awards, hackathons)
//       — kept in their own section at /contests, never mixed into the
//       scholarship catalogue.
export type RecordType = "SCHOLARSHIP" | "JOB" | "CONTEST";

export const RECORD_TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "Scholarship",
  JOB: "Job Listing",
  CONTEST: "Contest / Prize",
};

// --- Scholarship status -----------------------------------------------------
export type ScholarshipStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "ARCHIVED"
  | "PENDING"
  | "REJECTED";

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
  PENDING: "Pending Review",
  REJECTED: "Rejected",
};

// --- Language requirements --------------------------------------------------
export type LanguageRequirement =
  | "IELTS"
  | "TOEFL"
  | "NO_IELTS"
  | "ALTERNATIVE_PROOF"
  | "NOT_REQUIRED";

export const LANGUAGE_LABELS: Record<string, string> = {
  IELTS: "IELTS Required",
  TOEFL: "TOEFL Required",
  NO_IELTS: "No IELTS",
  ALTERNATIVE_PROOF: "Alternative English Proof",
  NOT_REQUIRED: "Language Not Required",
};

// --- Deadline windows -------------------------------------------------------
export type DeadlineWindow =
  | "closing-soon"
  | "this-week"
  | "this-month"
  | "next-3-months"
  | "open"
  | "upcoming";

// --- Fields of study --------------------------------------------------------
export interface FieldDef {
  slug: string;
  name: string;
}

export const FIELDS: FieldDef[] = [
  { slug: "computer-science", name: "Computer Science" },
  { slug: "artificial-intelligence", name: "Artificial Intelligence" },
  { slug: "data-science", name: "Data Science" },
  { slug: "cybersecurity", name: "Cybersecurity" },
  { slug: "engineering", name: "Engineering" },
  { slug: "mechanical-engineering", name: "Mechanical Engineering" },
  { slug: "civil-engineering", name: "Civil Engineering" },
  { slug: "electrical-engineering", name: "Electrical Engineering" },
  { slug: "electronic-engineering", name: "Electronic Engineering" },
  { slug: "chemical-engineering", name: "Chemical Engineering" },
  { slug: "software-engineering", name: "Software Engineering" },
  { slug: "computer-engineering", name: "Computer Engineering" },
  { slug: "aerospace-engineering", name: "Aerospace Engineering" },
  { slug: "biomedical-engineering", name: "Biomedical Engineering" },
  { slug: "environmental-engineering", name: "Environmental Engineering" },
  { slug: "materials-engineering", name: "Materials Engineering" },
  { slug: "industrial-engineering", name: "Industrial Engineering" },
  { slug: "power-engineering", name: "Power Engineering" },
  { slug: "energy-engineering", name: "Energy Engineering" },
  { slug: "control-engineering", name: "Control Engineering" },
  { slug: "petroleum-engineering", name: "Petroleum Engineering" },
  { slug: "transportation-engineering", name: "Transportation Engineering" },
  { slug: "manufacturing-engineering", name: "Manufacturing Engineering" },
  { slug: "systems-engineering", name: "Systems Engineering" },
  { slug: "mining-engineering", name: "Mining Engineering" },
  { slug: "structural-engineering", name: "Structural Engineering" },
  { slug: "automotive-engineering", name: "Automotive Engineering" },
  { slug: "geotechnical-engineering", name: "Geotechnical Engineering" },
  { slug: "agricultural-engineering", name: "Agricultural Engineering" },
  { slug: "nuclear-engineering", name: "Nuclear Engineering" },
  { slug: "robotics-engineering", name: "Robotics Engineering" },
  { slug: "telecommunication-engineering", name: "Telecommunication Engineering" },
  { slug: "water-resources-engineering", name: "Water Resources Engineering" },
  { slug: "medicine", name: "Medicine" },
  { slug: "public-health", name: "Public Health" },
  { slug: "nursing", name: "Nursing" },
  { slug: "biotechnology", name: "Biotechnology" },
  { slug: "biology", name: "Biology" },
  { slug: "dentistry", name: "Dentistry" },
  { slug: "chemistry", name: "Chemistry" },
  { slug: "physics", name: "Physics" },
  { slug: "mathematics", name: "Mathematics" },
  { slug: "statistics", name: "Statistics" },
  { slug: "natural-sciences", name: "Natural Sciences" },
  { slug: "environmental-science", name: "Environmental Science" },
  { slug: "energy", name: "Energy" },
  { slug: "business", name: "Business" },
  { slug: "finance", name: "Finance" },
  { slug: "economics", name: "Economics" },
  { slug: "marketing", name: "Marketing" },
  { slug: "accounting", name: "Accounting" },
  { slug: "law", name: "Law" },
  { slug: "political-science", name: "Political Science" },
  { slug: "international-relations", name: "International Relations" },
  { slug: "social-sciences", name: "Social Sciences" },
  { slug: "psychology", name: "Psychology" },
  { slug: "education", name: "Education" },
  { slug: "history", name: "History" },
  { slug: "philosophy", name: "Philosophy" },
  { slug: "linguistics", name: "Linguistics" },
  { slug: "classics", name: "Classics" },
  { slug: "humanities", name: "Humanities" },
  { slug: "agriculture", name: "Agriculture" },
  { slug: "architecture", name: "Architecture" },
  { slug: "arts", name: "Arts" },
  { slug: "design", name: "Design" },
  { slug: "media", name: "Media" },
  { slug: "music", name: "Music" },
  { slug: "tourism", name: "Tourism & Hospitality" },
  { slug: "sports-science", name: "Sports Science" },
];

export const fieldBySlug = (slug: string) => FIELDS.find((f) => f.slug === slug);
export const fieldName = (slug: string) => fieldBySlug(slug)?.name ?? slug;

// --- Broad field groups (umbrella categories) -------------------------------
// Parent categories that group related leaf fields. Filtering by a group slug
// matches every child field (plus open-to-all "ALL" records), while filtering
// by a leaf slug stays narrow. Leaf slugs may belong to several groups
// (biology is both a life science and a natural science) and a group's slug may
// also exist as a leaf tag (natural-sciences, social-sciences) — in that case
// the leaf tag is included in its own children so nothing is lost.
export interface FieldGroupDef {
  slug: string;
  name: string;
  description: string;
  children: string[]; // leaf field slugs (including the group's own leaf slug when it exists)
}

export const FIELD_GROUPS: FieldGroupDef[] = [
  {
    slug: "medicine-health",
    name: "Medicine & Health",
    description: "Clinical programs, nursing, public health, biomedical sciences and more.",
    children: ["medicine", "public-health", "nursing", "biotechnology", "biology", "dentistry", "psychology"],
  },
  {
    slug: "computer-science-it",
    name: "Computer Science & IT",
    description: "Software, artificial intelligence, data science and cybersecurity.",
    children: ["computer-science", "artificial-intelligence", "data-science", "cybersecurity"],
  },
  {
    slug: "business-economics",
    name: "Business & Economics",
    description: "Management, finance, economics, marketing and accounting.",
    children: ["business", "finance", "economics", "marketing", "accounting"],
  },
  {
    slug: "engineering",
    name: "Engineering",
    description: "Mechanical, civil, electrical, chemical and every other engineering discipline.",
    children: [
      "engineering",
      "mechanical-engineering",
      "civil-engineering",
      "electrical-engineering",
      "electronic-engineering",
      "chemical-engineering",
      "software-engineering",
      "computer-engineering",
      "aerospace-engineering",
      "biomedical-engineering",
      "environmental-engineering",
      "materials-engineering",
      "industrial-engineering",
      "power-engineering",
      "energy-engineering",
      "control-engineering",
      "petroleum-engineering",
      "transportation-engineering",
      "manufacturing-engineering",
      "systems-engineering",
      "mining-engineering",
      "structural-engineering",
      "automotive-engineering",
      "geotechnical-engineering",
      "agricultural-engineering",
      "nuclear-engineering",
      "robotics-engineering",
      "telecommunication-engineering",
      "water-resources-engineering",
    ],
  },
  {
    slug: "natural-sciences",
    name: "Natural Sciences",
    description: "Physics, chemistry, mathematics, biology and environmental science.",
    children: ["natural-sciences", "physics", "chemistry", "mathematics", "statistics", "biology", "environmental-science", "energy"],
  },
  {
    slug: "social-sciences",
    name: "Social Sciences & Humanities",
    description: "Law, politics, education, history, philosophy, languages and more.",
    children: ["social-sciences", "law", "political-science", "international-relations", "psychology", "education", "history", "philosophy", "linguistics", "classics", "humanities"],
  },
  {
    slug: "arts-design-media",
    name: "Arts, Design & Media",
    description: "Fine arts, design, media, music and architecture.",
    children: ["arts", "design", "media", "music", "architecture"],
  },
  {
    slug: "agriculture-environment",
    name: "Agriculture & Environment",
    description: "Agriculture, environmental science and related disciplines.",
    children: ["agriculture", "environmental-science"],
  },
];

export const fieldGroupBySlug = (slug: string) => FIELD_GROUPS.find((g) => g.slug === slug);

export const isFieldGroup = (slug: string) => FIELD_GROUPS.some((g) => g.slug === slug);

// Leaf slugs a filter on `slug` should match, or null if the slug is unknown.
// Groups expand to their children; leaves match only themselves.
export function fieldSlugsForFilter(slug: string): string[] | null {
  const group = fieldGroupBySlug(slug);
  if (group) return group.children;
  return fieldBySlug(slug) ? [slug] : null;
}

// Display name for either a leaf field or a group slug.
export function fieldDisplayName(slug: string): string {
  return fieldGroupBySlug(slug)?.name ?? fieldBySlug(slug)?.name ?? slug;
}

// --- Countries --------------------------------------------------------------
export interface CountryDef {
  code: string; // ISO alpha-2
  name: string;
  flag: string;
  region: string;
}

export const COUNTRIES: CountryDef[] = [
  { code: "US", name: "United States", flag: "🇺🇸", region: "North America" },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "North America" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", region: "Europe" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", region: "Europe" },
  { code: "AU", name: "Australia", flag: "🇦🇺", region: "Oceania" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", region: "Oceania" },
  { code: "DE", name: "Germany", flag: "🇩🇪", region: "Europe" },
  { code: "FR", name: "France", flag: "🇫🇷", region: "Europe" },
  { code: "IT", name: "Italy", flag: "🇮🇹", region: "Europe" },
  { code: "ES", name: "Spain", flag: "🇪🇸", region: "Europe" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", region: "Europe" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", region: "Europe" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", region: "Europe" },
  { code: "NO", name: "Norway", flag: "🇳🇴", region: "Europe" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", region: "Europe" },
  { code: "FI", name: "Finland", flag: "🇫🇮", region: "Europe" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", region: "Europe" },
  { code: "AT", name: "Austria", flag: "🇦🇹", region: "Europe" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", region: "Europe" },
  { code: "PL", name: "Poland", flag: "🇵🇱", region: "Europe" },
  { code: "CZ", name: "Czechia", flag: "🇨🇿", region: "Europe" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", region: "Europe" },
  { code: "GR", name: "Greece", flag: "🇬🇷", region: "Europe" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", region: "Europe" },
  { code: "JP", name: "Japan", flag: "🇯🇵", region: "Asia" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", region: "Asia" },
  { code: "CN", name: "China", flag: "🇨🇳", region: "Asia" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", region: "Asia" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", region: "Asia" },
  { code: "IN", name: "India", flag: "🇮🇳", region: "Asia" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", region: "Asia" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", region: "Asia" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", region: "Asia" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Asia" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", region: "Asia" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", region: "Asia" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", region: "Middle East" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", region: "Middle East" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", region: "Middle East" },
  { code: "IL", name: "Israel", flag: "🇮🇱", region: "Middle East" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", region: "Africa" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "Africa" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", region: "Africa" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", region: "Africa" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", region: "Africa" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", region: "South America" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", region: "South America" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", region: "South America" },
  { code: "CL", name: "Chile", flag: "🇨🇱", region: "South America" },
  { code: "RU", name: "Russia", flag: "🇷🇺", region: "Europe" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", region: "Europe" },
  // Additional countries present in the catalogue (added as scholarships from
  // EURAXESS / CUCAS / DAAD / other sources appeared for them).
  { code: "AD", name: "Andorra", flag: "🇦🇩", region: "Europe" },
  { code: "AL", name: "Albania", flag: "🇦🇱", region: "Europe" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿", region: "Asia" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", region: "Europe" },
  { code: "BN", name: "Brunei", flag: "🇧🇳", region: "Asia" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹", region: "Asia" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", region: "South America" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾", region: "Europe" },
  { code: "DZ", name: "Algeria", flag: "🇩🇿", region: "Africa" },
  { code: "EE", name: "Estonia", flag: "🇪🇪", region: "Europe" },
  { code: "EU", name: "Europe (Multiple Countries)", flag: "🇪🇺", region: "Europe" },
  { code: "GE", name: "Georgia", flag: "🇬🇪", region: "Asia" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", region: "Asia" },
  { code: "HR", name: "Croatia", flag: "🇭🇷", region: "Europe" },
  { code: "IR", name: "Iran", flag: "🇮🇷", region: "Middle East" },
  { code: "IS", name: "Iceland", flag: "🇮🇸", region: "Europe" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲", region: "North America" },
  { code: "KH", name: "Cambodia", flag: "🇰🇭", region: "Asia" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿", region: "Asia" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧", region: "Middle East" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", region: "Asia" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹", region: "Europe" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", region: "Europe" },
  { code: "LV", name: "Latvia", flag: "🇱🇻", region: "Europe" },
  { code: "MC", name: "Monaco", flag: "🇲🇨", region: "Europe" },
  { code: "MK", name: "North Macedonia", flag: "🇲🇰", region: "Europe" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲", region: "Asia" },
  { code: "MT", name: "Malta", flag: "🇲🇹", region: "Europe" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺", region: "Africa" },
  { code: "NP", name: "Nepal", flag: "🇳🇵", region: "Asia" },
  { code: "PE", name: "Peru", flag: "🇵🇪", region: "South America" },
  { code: "RO", name: "Romania", flag: "🇷🇴", region: "Europe" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮", region: "Europe" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰", region: "Europe" },
  { code: "SY", name: "Syria", flag: "🇸🇾", region: "Middle East" },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲", region: "Asia" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", region: "Asia" },
  { code: "GD", name: "Grenada", flag: "🇬🇩", region: "Caribbean" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿", region: "Asia" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", region: "Africa" },
];

// Country helpers are null-safe: imported listings may not have a country yet,
// in which case the UI renders "Not specified" rather than inventing one.
export const countryByCode = (code: string | null | undefined) =>
  code ? COUNTRIES.find((c) => c.code === code.toUpperCase()) : undefined;

export const countryName = (code: string | null | undefined) =>
  countryByCode(code)?.name ?? (code || "Multiple countries");

export const countryFlag = (code: string | null | undefined) =>
  countryByCode(code)?.flag ?? "🌍";

export const DEFAULT_COUNTRIES = COUNTRIES;

// --- Quick discovery categories (homepage + category pages) -----------------
export interface CategoryDef {
  slug: string;
  title: string;
  description: string;
  // URL builder for the scholarships page
  href: string;
}

export const QUICK_CATEGORIES: CategoryDef[] = [
  {
    slug: "fully-funded",
    title: "Fully Funded Scholarships",
    description: "Tuition, living expenses, travel and more.",
    href: "/scholarships?funding=FULLY_FUNDED,FULLY_FUNDED_STIPEND",
  },
  {
    slug: "no-ielts",
    title: "Scholarships Without IELTS",
    description: "Discover opportunities with alternative language requirements.",
    href: "/scholarships?language=no-ielts",
  },
  {
    slug: "undergraduate",
    title: "Undergraduate Scholarships",
    description: "Funding opportunities for bachelor's students.",
    href: "/scholarships?level=undergraduate",
  },
  {
    slug: "masters",
    title: "Master's Scholarships",
    description: "Find scholarships for graduate study.",
    href: "/scholarships?level=masters",
  },
  {
    slug: "phd",
    title: "PhD & Research",
    description: "Fully funded doctoral and research opportunities.",
    href: "/scholarships?level=phd",
  },
  {
    slug: "international-students",
    title: "Scholarships for International Students",
    description: "Study abroad with financial support.",
    href: "/scholarships?nationality=international",
  },
  {
    slug: "global",
    title: "Global & Multi-Country",
    description: "Erasmus Mundus, international fellowships and online programmes.",
    href: "/scholarships/global",
  },
];

export const categoryBySlug = (slug: string) =>
  QUICK_CATEGORIES.find((c) => c.slug === slug);

// --- Default application steps (used when a scholarship has none) -----------
export const DEFAULT_APPLICATION_STEPS = [
  "Check eligibility",
  "Prepare required documents",
  "Apply for admission if required",
  "Complete scholarship application",
  "Submit before deadline",
  "Wait for the result",
];

// --- Page size for scholarship listings -------------------------------------
export const SCHOLARSHIPS_PER_PAGE = 12;

// --- Admin contact email ----------------------------------------------------
export const CONTACT_EMAIL = "hello@scholaratlas.dev";

// Anti-spam honeypot field name — shared so client forms and server actions
// agree on the same invisible field without importing server-only modules.
export const HONEYPOT_FIELD = "companyWebsite";


