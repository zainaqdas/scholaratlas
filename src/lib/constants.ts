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

export const BENEFITS: { key: BenefitKey; label: string; icon: string }[] = [
  { key: "tuition", label: "Full Tuition Fee", icon: "🎓" },
  { key: "stipend", label: "Monthly Stipend", icon: "💶" },
  { key: "accommodation", label: "Accommodation", icon: "🏠" },
  { key: "insurance", label: "Health Insurance", icon: "🩺" },
  { key: "airfare", label: "Airfare", icon: "✈️" },
  { key: "visaSupport", label: "Visa Support", icon: "🛂" },
  { key: "researchAllowance", label: "Research Allowance", icon: "🔬" },
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
  icon: string;
}

export const FIELDS: FieldDef[] = [
  { slug: "computer-science", name: "Computer Science", icon: "💻" },
  { slug: "artificial-intelligence", name: "Artificial Intelligence", icon: "🤖" },
  { slug: "data-science", name: "Data Science", icon: "📊" },
  { slug: "cybersecurity", name: "Cybersecurity", icon: "🛡️" },
  { slug: "engineering", name: "Engineering", icon: "⚙️" },
  { slug: "medicine", name: "Medicine", icon: "🩺" },
  { slug: "public-health", name: "Public Health", icon: "🌍" },
  { slug: "nursing", name: "Nursing", icon: "🏥" },
  { slug: "biotechnology", name: "Biotechnology", icon: "🧬" },
  { slug: "biology", name: "Biology", icon: "🧫" },
  { slug: "chemistry", name: "Chemistry", icon: "🧪" },
  { slug: "physics", name: "Physics", icon: "⚛️" },
  { slug: "mathematics", name: "Mathematics", icon: "📐" },
  { slug: "natural-sciences", name: "Natural Sciences", icon: "🔭" },
  { slug: "environmental-science", name: "Environmental Science", icon: "🌱" },
  { slug: "business", name: "Business", icon: "💼" },
  { slug: "finance", name: "Finance", icon: "💰" },
  { slug: "economics", name: "Economics", icon: "📈" },
  { slug: "marketing", name: "Marketing", icon: "📣" },
  { slug: "accounting", name: "Accounting", icon: "🧾" },
  { slug: "law", name: "Law", icon: "⚖️" },
  { slug: "political-science", name: "Political Science", icon: "🏛️" },
  { slug: "international-relations", name: "International Relations", icon: "🌐" },
  { slug: "social-sciences", name: "Social Sciences", icon: "👥" },
  { slug: "psychology", name: "Psychology", icon: "🧠" },
  { slug: "education", name: "Education", icon: "📚" },
  { slug: "agriculture", name: "Agriculture", icon: "🌾" },
  { slug: "architecture", name: "Architecture", icon: "🏗️" },
  { slug: "arts", name: "Arts", icon: "🎨" },
  { slug: "design", name: "Design", icon: "🖌️" },
  { slug: "media", name: "Media", icon: "🎬" },
  { slug: "music", name: "Music", icon: "🎵" },
  { slug: "history", name: "History", icon: "📜" },
  { slug: "philosophy", name: "Philosophy", icon: "🧿" },
  { slug: "linguistics", name: "Linguistics", icon: "🗣️" },
  { slug: "tourism", name: "Tourism & Hospitality", icon: "✈️" },
  { slug: "sports-science", name: "Sports Science", icon: "🏅" },
];

export const fieldBySlug = (slug: string) => FIELDS.find((f) => f.slug === slug);
export const fieldName = (slug: string) => fieldBySlug(slug)?.name ?? slug;

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
];

// Country helpers are null-safe: imported listings may not have a country yet,
// in which case the UI renders "Not specified" rather than inventing one.
export const countryByCode = (code: string | null | undefined) =>
  code ? COUNTRIES.find((c) => c.code === code.toUpperCase()) : undefined;

export const countryName = (code: string | null | undefined) =>
  countryByCode(code)?.name ?? (code || "Not specified");

export const countryFlag = (code: string | null | undefined) =>
  countryByCode(code)?.flag ?? "🌍";

export const DEFAULT_COUNTRIES = COUNTRIES;

// --- Quick discovery categories (homepage + category pages) -----------------
export interface CategoryDef {
  slug: string;
  title: string;
  description: string;
  icon: string;
  // URL builder for the scholarships page
  href: string;
}

export const QUICK_CATEGORIES: CategoryDef[] = [
  {
    slug: "fully-funded",
    title: "Fully Funded Scholarships",
    description: "Tuition, living expenses, travel and more.",
    icon: "💎",
    href: "/scholarships?funding=FULLY_FUNDED,FULLY_FUNDED_STIPEND",
  },
  {
    slug: "no-ielts",
    title: "Scholarships Without IELTS",
    description: "Discover opportunities with alternative language requirements.",
    icon: "🗣️",
    href: "/scholarships?language=no-ielts",
  },
  {
    slug: "undergraduate",
    title: "Undergraduate Scholarships",
    description: "Funding opportunities for bachelor's students.",
    icon: "🎓",
    href: "/scholarships?level=undergraduate",
  },
  {
    slug: "masters",
    title: "Master's Scholarships",
    description: "Find scholarships for graduate study.",
    icon: "📘",
    href: "/scholarships?level=masters",
  },
  {
    slug: "phd",
    title: "PhD & Research",
    description: "Fully funded doctoral and research opportunities.",
    icon: "🔬",
    href: "/scholarships?level=phd",
  },
  {
    slug: "international-students",
    title: "Scholarships for International Students",
    description: "Study abroad with financial support.",
    icon: "🌍",
    href: "/scholarships?nationality=international",
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

// --- Demo notice ------------------------------------------------------------
export const DEMO_NOTICE =
  "Demo environment: scholarship records shown here are sample data for development.";
