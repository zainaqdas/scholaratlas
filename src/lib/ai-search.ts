// Heuristic natural-language → structured search parser for the "Ask ScholarAtlas"
// assistant. This is a deterministic, rule-based matcher (no LLM required) that
// converts free text into structured search criteria. The architecture allows a
// real LLM call to replace this function later without changing the UI.

import { COUNTRIES, FIELDS, FIELD_GROUPS, studyLevelSlug, FUNDING_TYPES, fieldDisplayName } from "./constants";

export interface AiSearchCriteria {
  q?: string;
  levels?: string[];
  funding?: string[];
  countries?: string[];
  nationality?: string;
  field?: string;
  noIelts?: boolean;
}

const LEVEL_KEYWORDS: { slug: string; words: string[] }[] = [
  { slug: "phd", words: ["phd", "doctorate", "doctoral", "doctor of philosophy"] },
  { slug: "postdoctoral", words: ["postdoc", "post-doc", "postdoctoral", "post doctoral"] },
  { slug: "masters", words: ["master", "masters", "master's", "msc", "ma ", "graduate degree", "postgraduate"] },
  { slug: "mba", words: ["mba"] },
  { slug: "undergraduate", words: ["undergraduate", "bachelor", "bachelors", "bsc", "beng", "ba degree", "bachelor's"] },
  { slug: "research", words: ["research", "researcher", "research position"] },
  { slug: "short-course", words: ["short course", "summer school", "short term"] },
  { slug: "exchange-program", words: ["exchange", "erasmus"] },
  { slug: "high-school", words: ["high school", "secondary school"] },
];

const FUNDING_KEYWORDS: { value: string; words: string[] }[] = [
  { value: "FULLY_FUNDED", words: ["fully funded", "full funding", "fully-funded", "full scholarship", "complete funding"] },
  { value: "FULLY_FUNDED_STIPEND", words: ["stipend", "monthly allowance", "salary"] },
  { value: "TUITION_WAIVER", words: ["tuition waiver", "fee waiver", "tuition free"] },
  { value: "PARTIAL", words: ["partial", "partial funding"] },
];

const NATIONALITY_KEYWORDS: { code: string; words: string[] }[] = COUNTRIES.map((c) => ({
  code: c.code,
  words: [c.name.toLowerCase(), c.code.toLowerCase()],
})).concat([
  { code: "PK", words: ["pakistani", "from pakistan"] },
  { code: "IN", words: ["indian", "from india"] },
  { code: "BD", words: ["bangladeshi", "from bangladesh"] },
  { code: "NG", words: ["nigerian", "from nigeria"] },
  { code: "VN", words: ["vietnamese", "from vietnam"] },
]);

// Common aliases for countries whose codes differ from the spoken name
// ("usa" → US, "uk" → GB, "korea" → KR, ...).
const COUNTRY_ALIASES: [string, string][] = [
  ["united states of america", "US"],
  ["usa", "US"],
  ["u.s.", "US"],
  ["united kingdom", "GB"],
  ["uk", "GB"],
  ["u.k.", "GB"],
  ["england", "GB"],
  ["britain", "GB"],
  ["united arab emirates", "AE"],
  ["uae", "AE"],
  ["u.a.e.", "AE"],
  ["emirates", "AE"],
  ["korea", "KR"],
  ["south korea", "KR"],
  ["holland", "NL"],
  ["the netherlands", "NL"],
  ["czech republic", "CZ"],
  ["saudi arabia", "SA"],
  ["saudi", "SA"],
];

// Region words map to the set of destination country codes in that region
// (e.g. "in Europe" should search all European destinations).
const REGION_COUNTRIES: Record<string, string[]> = {
  europe: COUNTRIES.filter((c) => c.region === "Europe").map((c) => c.code),
  asia: COUNTRIES.filter((c) => c.region === "Asia").map((c) => c.code),
  "north america": COUNTRIES.filter((c) => c.region === "North America").map((c) => c.code),
  "south america": COUNTRIES.filter((c) => c.region === "South America").map((c) => c.code),
  africa: COUNTRIES.filter((c) => c.region === "Africa").map((c) => c.code),
  "middle east": COUNTRIES.filter((c) => c.region === "Middle East").map((c) => c.code),
  oceania: COUNTRIES.filter((c) => c.region === "Oceania").map((c) => c.code),
};
const REGION_NAMES = Object.keys(REGION_COUNTRIES);

const STOPWORDS = new Set([
  "i", "i'm", "im", "me", "my", "a", "an", "the", "and", "or", "for", "in", "to", "with", "without",
  "on", "at", "of", "from", "please", "can", "you", "help", "find", "looking", "want", "need",
  "would", "like", "have", "has", "do", "does", "is", "are", "am", "be", "it", "this", "that",
  "scholarship", "scholarships", "study", "studying", "studies", "student", "students", "program",
  "programme", "programs", "programmes", "funded", "funding", "fully", "some", "any", "there",
  "opportunity", "opportunities", "options", "option", "available", "best", "good", "great",
]);

// Phrases recognised by the structured parsers below; they are stripped from the
// leftover keyword query so that q never ANDs the full sentence against the DB.
function collectMatchedPhrases(raw: string): string[] {
  const text = raw.toLowerCase();
  const matched: string[] = [];
  const push = (w: string) => {
    if (w && !matched.includes(w)) matched.push(w);
  };

  for (const level of LEVEL_KEYWORDS) level.words.forEach((w) => text.includes(w) && push(w));
  for (const f of FUNDING_KEYWORDS) f.words.forEach((w) => text.includes(w) && push(w));
  if (/no ielts|without ielts|no english test|no toefl|don'?t need ielts|no language test/.test(text)) {
    push("no ielts");
    push("without ielts");
  }
  const escP = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const c of COUNTRIES) {
    const name = c.name.toLowerCase();
    const code = c.code.toLowerCase();
    const nameRx = (pre: string) => new RegExp(`\\b${pre}\\s+${escP(name)}\\b`).test(text);
    const codeRx = (pre: string) => new RegExp(`\\b${pre}\\s+${escP(code)}\\b`).test(text);
    if (nameRx("study in") || nameRx("in") || nameRx("to") || nameRx("for")) push(name);
    else if (codeRx("study in") || codeRx("in") || codeRx("to") || codeRx("for")) push(code);
  }
  for (const region of REGION_NAMES) {
    if (text.includes(` in ${region}`) || text.includes(`to ${region}`) || text.includes(`study in ${region}`)) push(region);
  }
  for (const [alias] of COUNTRY_ALIASES) {
    if (new RegExp(`(in|to|for|study in)\\s+(the\\s+)?${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) push(alias);
  }
  for (const f of FIELDS) {
    const name = f.name.toLowerCase();
    if (text.includes(name)) push(name);
    if (text.includes(f.slug.replace(/-/g, " "))) push(f.slug.replace(/-/g, " "));
  }
  if (/comp\s*sci|cs\b/.test(text)) push("cs");
  if (/machine learning|deep learning/.test(text)) push("machine learning");

  return matched;
}

// Leftover words that don't belong to any recognised criteria become the keyword
// query (e.g. "women", "environment", "neuroscience").
function leftoverQuery(raw: string, matched: string[]): string | undefined {
  let remaining = ` ${raw.toLowerCase()} `;
  for (const m of matched) {
    remaining = remaining.split(m).join(" ");
  }
  const tokens = remaining
    .split(/[^a-z0-9']+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t && t.length > 1 && !STOPWORDS.has(t));
  return tokens.length ? tokens.join(" ").slice(0, 200) : undefined;
}

export function parseAiQuery(raw: string): AiSearchCriteria {
  const text = raw.toLowerCase();
  const criteria: AiSearchCriteria = {};

  // Nationality: "I'm from X" / "I am Pakistani" — detect BEFORE destination so
  // the country of origin is not mistaken for the study destination.
  const fromMatch = text.match(/from\s+([a-z\s]+?)(?=,|\.|$|\sand\s|\swant|\sneed|\swould|\sfor\s)/);
  let originCountry: string | undefined;
  const matched = collectMatchedPhrases(raw);
  if (fromMatch) {
    const origin = fromMatch[1].trim();
    for (const n of NATIONALITY_KEYWORDS) {
      if (n.words.some((w) => origin.includes(w) || origin === w)) {
        criteria.nationality = n.code;
        originCountry = n.code;
        const originName = COUNTRIES.find((c) => c.code === n.code)?.name.toLowerCase();
        if (originName && !matched.includes(originName)) matched.push(originName);
        break;
      }
    }
  }

  // Keyword query computed at the end so nationality phrases are stripped too

  // Study level
  for (const level of LEVEL_KEYWORDS) {
    if (level.words.some((w) => text.includes(w))) {
      criteria.levels = [...(criteria.levels ?? []), level.slug];
    }
  }
  if (!criteria.levels?.length) criteria.levels = undefined;

  // Funding
  for (const f of FUNDING_KEYWORDS) {
    if (f.words.some((w) => text.includes(w))) {
      criteria.funding = [...(criteria.funding ?? []), f.value];
    }
  }
  // "fully funded" implies both FULLY_FUNDED and FULLY_FUNDED_STIPEND variants
  if (criteria.funding?.includes("FULLY_FUNDED") && !criteria.funding.includes("FULLY_FUNDED_STIPEND")) {
    criteria.funding.push("FULLY_FUNDED_STIPEND");
  }
  // keep list deduped
  if (criteria.funding?.length) {
    criteria.funding = [...new Set(criteria.funding)];
  }

  // No IELTS / no English test
  if (/no ielts|without ielts|no english test|no toefl|don'?t need ielts|no language test/.test(text)) {
    criteria.noIelts = true;
  }

  // Destination country (last country mention wins; common prepositions help).
  // Country codes need \b word boundaries so "for international" never matches
  // "for in" and "to use" never matches "to us".
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const c of COUNTRIES) {
    const name = c.name.toLowerCase();
    const code = c.code.toLowerCase();
    const nameRx = (pre: string) => new RegExp(`\\b${pre}\\s+${esc(name)}\\b`).test(text);
    const codeRx = (pre: string) => new RegExp(`\\b${pre}\\s+${esc(code)}\\b`).test(text);
    const studyPhrase = nameRx("study in") || codeRx("study in");
    const inPhrase = nameRx("in") || codeRx("in");
    const toPhrase = nameRx("to") || codeRx("to");
    const forPhrase = nameRx("for") || codeRx("for");
    if (studyPhrase || inPhrase || toPhrase || forPhrase) {
      criteria.countries = [c.code];
      break;
    }
  }
  // Alias destination ("in the USA", "to the UK", "study in Korea"...)
  if (!criteria.countries) {
    for (const [alias, code] of COUNTRY_ALIASES) {
      if (new RegExp(`(in|to|for|study in)\\s+(the\\s+)?${esc(alias)}\\b`).test(text)) {
        criteria.countries = [code];
        break;
      }
    }
  }
  // Region destination ("in Europe", "in Asia"...) → all countries in the region
  if (!criteria.countries) {
    for (const region of REGION_NAMES) {
      if (text.includes(` in ${region}`) || text.includes(`to ${region}`) || text.includes(`study in ${region}`)) {
        criteria.countries = REGION_COUNTRIES[region];
        break;
      }
    }
  }
  // Fallback: any country name mentioned as a standalone word (excluding origin)
  if (!criteria.countries) {
    for (const c of COUNTRIES) {
      if (c.code === originCountry) continue;
      const name = c.name.toLowerCase();
      const match = text.match(new RegExp(`\\b${esc(name)}\\b`));
      if (match) {
        criteria.countries = [c.code];
        break;
      }
    }
  }

  // Nationality via "for X students" ("for Nigerian students", "for Pakistani applicants")
  if (!criteria.nationality) {
    for (const n of NATIONALITY_KEYWORDS) {
      const word = n.words.find((w) => new RegExp(`for\\s+${esc(w)}\\s+(students|applicants|nationals|citizens)\\b`).test(text));
      if (word) {
        criteria.nationality = n.code;
        if (!matched.includes(word)) matched.push(word);
        break;
      }
    }
  }

  // Field of study — specific leaf fields win over broad group names so
  // "computer science" maps to computer-science, not the CS & IT umbrella.
  for (const f of FIELDS) {
    const name = f.name.toLowerCase();
    if (text.includes(name) || text.includes(f.slug.replace(/-/g, " "))) {
      criteria.field = f.slug;
      break;
    }
  }
  if (!criteria.field) {
    for (const g of FIELD_GROUPS) {
      const name = g.name.toLowerCase();
      if (text.includes(name) || text.includes(g.slug.replace(/-/g, " "))) {
        criteria.field = g.slug;
        break;
      }
    }
  }
  // common alias: "cs" / "computer science" handled by FIELDS name; "comp sci"
  if (!criteria.field && /comp\s*sci|cs\b/.test(text)) {
    criteria.field = "computer-science";
  }
  if (!criteria.field && /ai\b|machine learning|deep learning/.test(text)) {
    criteria.field = "artificial-intelligence";
  }

  // Keyword query = leftover text after recognised phrases are removed
  criteria.q = leftoverQuery(raw, matched);

  return criteria;
}

export function criteriaToFilters(c: AiSearchCriteria) {
  return {
    q: c.q,
    levels: c.levels,
    funding: c.funding,
    countries: c.countries,
    nationality: c.nationality,
    field: c.field,
    languages: c.noIelts ? ["no-ielts"] : undefined,
  };
}

export function criteriaSummary(c: AiSearchCriteria): string[] {
  const parts: string[] = [];
  if (c.levels?.length) parts.push(c.levels.map((l) => l.replace(/-/g, " ")).join(", "));
  if (c.funding?.length) parts.push(FUNDING_TYPES.find((f) => f.value === c.funding?.[0])?.label ?? "funded");
  if (c.countries?.length) parts.push(`in ${COUNTRIES.find((x) => x.code === c.countries?.[0])?.name ?? c.countries[0]}`);
  if (c.field) parts.push(fieldDisplayName(c.field));
  if (c.noIelts) parts.push("no IELTS");
  if (c.nationality) parts.push(`nationality: ${COUNTRIES.find((x) => x.code === c.nationality)?.name ?? c.nationality}`);
  return parts;
}

export { studyLevelSlug };
