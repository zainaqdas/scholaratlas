// Retag ALL scholarship records (active AND expired) with field slugs so every
// programme carries ALL its relevant fields and subfields.
//
// Why this script exists: the earlier backfills were incomplete —
// `backfill-fields.ts` only ran on ACTIVE records and stopped at the FIRST
// matching tier (so a record got one tag even when several applied), and the
// engineering/medicine subfield refinements also skipped EXPIRED records.
// The user asked for every country x university x programme matchup to be
// tagged with all relevant fields/subfields, active or expired.
//
// Approach (multi-tag, conservative):
//   1. Title tier — word-boundary keyword match on the PROGRAM part of the
//      title (everything before " at ", " — ", or " - " so university/org
//      names never trigger a tag).
//   2. Strong tier on the title — subject regexes for terms the keyword table
//      doesn't cover (geology, humanities, social sciences, …).
//   3. Phrase tier on body text — "major in X", "degree in X", "studying X"…
//   4. Strong tier on body text (description + eligibility/process) — guarded
//      word-boundary regexes that avoid boilerplate false positives.
//   ALL matching tiers are UNIONed into the tag set (not first-match), then
//   merged with the existing tags.
//   5. Subfield refinement — records matched/confirmed in a parent field get
//      the specific sub-discipline slug too ("mechanical engineering" →
//      engineering + mechanical-engineering; AI/ML → computer-science +
//      artificial-intelligence; oncology → medicine; microbiology → biology).
//
// Records whose text never names a subject stay untagged (honest). Records
// tagged "ALL" (open to all fields) are left untouched.
//
// Usage: npx tsx scripts/retag-all-fields.ts [--dry-run]
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { FIELDS } from "../src/lib/constants";

const DRY_RUN = process.argv.includes("--dry-run");
const DUMP = process.argv.includes("--dump");

const validSlugs = new Set(FIELDS.map((f) => f.slug));

// Split "Program — University (Level)" / "Title at University 2026" / "Title - Uni"
// so university and organization names never drive a tag.
const TITLE_SPLIT = /\s+(?:at|—|-)\s+/i;
function subjectOf(title: string): string {
  return title.split(TITLE_SPLIT)[0].toLowerCase();
}

// --- Title keywords (program-part match, word boundaries) --------------------
const TITLE_KEYWORDS: [string, string][] = [
  // Computer science & IT
  ["computer science", "computer-science"], ["software", "computer-science"],
  ["information technology", "computer-science"], ["informatics", "computer-science"],
  ["computing", "computer-science"], ["computer", "computer-science"],
  ["artificial intelligence", "artificial-intelligence"], ["machine learning", "artificial-intelligence"],
  ["data science", "data-science"], ["big data", "data-science"], ["data analytics", "data-science"],
  ["cybersecurity", "cybersecurity"], ["cyber security", "cybersecurity"], ["information security", "cybersecurity"],
  // Engineering (parent) + explicit sub-disciplines
  ["engineering", "engineering"], ["automation", "engineering"],
  ["mechanical engineering", "mechanical-engineering"], ["civil engineering", "civil-engineering"],
  ["electrical engineering", "electrical-engineering"], ["electronic engineering", "electronic-engineering"],
  ["chemical engineering", "chemical-engineering"], ["software engineering", "software-engineering"],
  ["computer engineering", "computer-engineering"], ["aerospace engineering", "aerospace-engineering"],
  ["aeronautical engineering", "aerospace-engineering"], ["biomedical engineering", "biomedical-engineering"],
  ["bioengineering", "biomedical-engineering"], ["environmental engineering", "environmental-engineering"],
  ["materials engineering", "materials-engineering"], ["materials science", "materials-engineering"],
  ["industrial engineering", "industrial-engineering"], ["power engineering", "power-engineering"],
  ["energy engineering", "energy-engineering"], ["control engineering", "control-engineering"],
  ["petroleum engineering", "petroleum-engineering"], ["transportation engineering", "transportation-engineering"],
  ["manufacturing engineering", "manufacturing-engineering"], ["systems engineering", "systems-engineering"],
  ["mining engineering", "mining-engineering"], ["structural engineering", "structural-engineering"],
  ["automotive engineering", "automotive-engineering"], ["geotechnical engineering", "geotechnical-engineering"],
  ["agricultural engineering", "agricultural-engineering"], ["nuclear engineering", "nuclear-engineering"],
  ["robotics engineering", "robotics-engineering"], ["telecommunication engineering", "telecommunication-engineering"],
  ["water resources engineering", "water-resources-engineering"],
  ["aviation", "engineering"], ["instrumentation", "engineering"],
  // Medicine & health (parent + subfields)
  ["medicine", "medicine"], ["medical", "medicine"], ["clinical medicine", "medicine"],
  ["pharmacology", "medicine"], ["pharmacy", "medicine"], ["pharmaceutical science", "medicine"],
  ["pharmaceutical sciences", "medicine"], ["medicinal chemistry", "medicine"],
  ["mbbs", "medicine"], ["bachelor of medicine", "medicine"], ["doctor of medicine", "medicine"],
  ["public health", "public-health"], ["global health", "public-health"], ["epidemiology", "public-health"],
  ["nursing", "nursing"],
  ["dentistry", "dentistry"], ["dental", "dentistry"],
  ["biotechnology", "biotechnology"], ["bioengineering", "biotechnology"],
  ["biology", "biology"], ["biological", "biology"], ["biochemistry", "biology"],
  ["microbiology", "biology"], ["genetics", "biology"], ["neuroscience", "biology"],
  ["botany", "biology"], ["zoology", "biology"], ["ecology", "biology"], ["life science", "biology"],
  ["psychology", "psychology"], ["psychiatry", "psychology"],
  // Natural sciences
  ["chemistry", "chemistry"], ["physics", "physics"], ["astronomy", "physics"],
  ["mathematics", "mathematics"], ["math", "mathematics"], ["statistics", "statistics"],
  ["geology", "natural-sciences"], ["geography", "natural-sciences"], ["earth science", "natural-sciences"],
  ["environmental science", "environmental-science"], ["environmental", "environmental-science"],
  ["energy", "energy"],
  // Business & economics
  ["business administration", "business"], ["business", "business"], ["management", "business"],
  ["mba", "business"], ["commerce", "business"], ["entrepreneurship", "business"],
  ["marketing", "marketing"], ["advertising", "marketing"], ["accounting", "accounting"],
  ["finance", "finance"], ["financial", "finance"], ["economics", "economics"], ["economy", "economics"],
  // Social sciences & humanities
  ["law", "law"], ["legal", "law"], ["criminology", "law"],
  ["political science", "political-science"], ["politics", "political-science"],
  ["public administration", "political-science"], ["public policy", "political-science"],
  ["international relations", "international-relations"], ["diplomacy", "international-relations"],
  ["international trade", "international-relations"], ["international development", "international-relations"],
  ["social sciences", "social-sciences"], ["sociology", "social-sciences"],
  ["anthropology", "social-sciences"], ["social work", "social-sciences"], ["humanities", "humanities"],
  ["education", "education"], ["teaching", "education"],
  ["history", "history"], ["philosophy", "philosophy"],
  ["linguistics", "linguistics"], ["translation", "linguistics"], ["english", "linguistics"],
  ["japanese", "linguistics"], ["chinese language", "linguistics"], ["foreign language", "linguistics"],
  // Agriculture & environment
  ["agriculture", "agriculture"], ["agronomy", "agriculture"], ["food science", "agriculture"],
  ["forestry", "agriculture"], ["horticulture", "agriculture"], ["plant science", "biology"],
  // Arts, design & media
  ["architecture", "architecture"], ["urban planning", "architecture"], ["landscape", "architecture"],
  ["fine arts", "arts"], ["art", "arts"], ["arts", "arts"], ["performing arts", "arts"],
  ["design", "design"], ["fashion", "design"],
  ["media", "media"], ["journalism", "media"], ["communication", "media"], ["film", "media"],
  ["music", "music"],
  ["tourism", "tourism"], ["hotel", "tourism"], ["hospitality", "tourism"],
  ["sports", "sports-science"], ["athletic", "sports-science"], ["physical education", "sports-science"],
];

// --- Strong subject regexes (title OR body, word boundaries) ------------------
const STRONG: [RegExp, string][] = [
  [/\bcomputer science\b/, "computer-science"], [/\bsoftware\b/, "computer-science"],
  [/\binformation technology\b/, "computer-science"], [/\binformatics\b/, "computer-science"],
  [/\bartificial intelligence\b/, "artificial-intelligence"], [/\bmachine learning\b/, "artificial-intelligence"],
  [/\bdata science\b/, "data-science"], [/\bbig data\b/, "data-science"],
  [/\bcyber ?security\b/, "cybersecurity"],
  [/\bengineering\b/, "engineering"], [/\bmechanical\b/, "engineering"], [/\belectrical\b/, "engineering"],
  [/\bchemical engineering\b/, "engineering"], [/\bcivil engineering\b/, "engineering"],
  [/\baerospace\b/, "engineering"], [/\brobotics\b/, "engineering"],
  [/\bpetroleum\b/, "engineering"], [/\bmining\b/, "engineering"],
  [/\bmedicine\b/, "medicine"], [/\bclinical\b/, "medicine"],
  [/\bdental\b/, "dentistry"], [/\bveterinary\b/, "medicine"], [/\bpharmacy\b/, "medicine"],
  [/\bpharmacolog/, "medicine"], [/\bepidemiolog/, "public-health"], [/\bpublic health\b/, "public-health"],
  [/\bmedical\s+(?:school|student|students|degree|education|research|sciences?|field|program|programme|college|university|faculty)\b/i, "medicine"],
  [/\b(?:of medicine|in medicine|study medicine|medicine and)\b/i, "medicine"],
  [/\bnursing\b/, "nursing"],
  [/\bbiotechnology\b/, "biotechnology"], [/\bbiomedical\b/, "biotechnology"],
  [/\bbiology\b/, "biology"], [/\bbiological\b/, "biology"],
  [/\bneuroscience\b/, "biology"], [/\bgenetics\b/, "biology"], [/\bmicrobiology\b/, "biology"],
  [/\bbiochemistr/, "biology"],
  [/\bchemistry\b/, "chemistry"], [/\bchemical\b/, "chemistry"],
  [/\bphysics\b/, "physics"], [/\bastronomy\b/, "physics"], [/\bquantum\b/, "physics"],
  [/\bmathematics\b/, "mathematics"], [/\bstatistics\b/, "statistics"], [/\bstatistical\b/, "statistics"],
  [/\bgeolog/, "natural-sciences"], [/\bearth science\b/, "natural-sciences"], [/\bgeography\b/, "natural-sciences"],
  [/\benvironmental science\b/, "environmental-science"], [/\bclimate\b/, "environmental-science"],
  [/\bsustainab/, "environmental-science"],
  [/\bbusiness administration\b/, "business"], [/\bmba\b/, "business"],
  [/\bentrepreneurship\b/, "business"], [/\bcommerce\b/, "business"],
  [/\baccounting\b/, "accounting"], [/\baudit/, "accounting"],
  [/\bfinance\b/, "finance"], [/\bbanking\b/, "finance"], [/\binvestment\b/, "finance"],
  [/\beconomics\b/, "economics"], [/\beconometrics\b/, "economics"],
  [/\bmarketing\b/, "marketing"], [/\badvertising\b/, "marketing"],
  [/\b(?:law\s+(?:school|student|students|degree|studies|program|faculty|major|practice|firm|clinic|courses?|classes?|curriculum|department|professor)|in law|of law|studying law|pursuing law|study law|juris doctor|llm|lawyer|attorney)\b/i, "law"],
  [/\blegal\b/, "law"], [/\bcriminology\b/, "law"],
  [/\bpolitical science\b/, "political-science"], [/\bpolitics\b/, "political-science"],
  [/\bpublic policy\b/, "political-science"],
  [/\binternational relations\b/, "international-relations"], [/\bdiplomacy\b/, "international-relations"],
  [/\binternational development\b/, "international-relations"],
  [/\bsociology\b/, "social-sciences"], [/\banthropology\b/, "social-sciences"],
  [/\bsocial work\b/, "social-sciences"], [/\bhumanities\b/, "humanities"], [/\bsocial sciences?\b/, "social-sciences"],
  [/\bpsychology\b/, "psychology"], [/\bpsychiatry\b/, "psychology"],
  [/\b(?:education\s+(?:studies|program|programme|degree|major|school|faculty)|of education|in education|teacher education|education and|education,)\b/i, "education"],
  [/\bteaching\s+(?:degree|career|profession|program|programme|certificate|credential)\b/i, "education"],
  [/\bagriculture\b/, "agriculture"], [/\bagronomy\b/, "agriculture"], [/\bhorticulture\b/, "agriculture"],
  [/\bforestry\b/, "agriculture"], [/\bfood science\b/, "agriculture"],
  [/\barchitecture\b/, "architecture"], [/\burban planning\b/, "architecture"], [/\blandscape\b/, "architecture"],
  [/\bfine arts\b/, "arts"], [/\bperforming arts\b/, "arts"], [/\bvisual arts\b/, "arts"], [/\btheatre\b/, "arts"],
  [/\bdesign\b/, "design"], [/\bfashion\b/, "design"],
  [/\bjournalism\b/, "media"], [/(?<!social\s+)media\b/i, "media"], [/\bcommunication\b/, "media"], [/\bfilm\b/, "media"],
  [/\bmusic\b/, "music"],
  [/(?<!\b(?:academic|work|family|payment|employment|credit|financial|medical|school|career|personal|life|oral|written|social|legal|prior|past)\s+)history\b/i, "history"],
  [/\bphilosophy\b/, "philosophy"],
  [/\blinguistics\b/, "linguistics"], [/\btranslation\b/, "linguistics"],
  [/\btourism\b/, "tourism"], [/\bhospitality\b/, "tourism"],
  [/\bsports?\b/, "sports-science"], [/\bathletic\b/, "sports-science"],
];

// --- Explicit subject phrases in body text ------------------------------------
const PHRASE_RE =
  /(?:major(?:ing)? in|degree in|studying|pursuing|enrolled in|field of)\s+([a-z &,]+?)(?=\s+at\b|\s+to\b|\.|$)/i;
const SUBJECT_MAP: [string, string][] = [
  ["accounting", "accounting"],  ["finance", "finance"], ["economics", "economics"], ["business", "business"], ["management", "business"],
  ["marketing", "marketing"], ["law", "law"], ["legal", "law"], ["computer science", "computer-science"],
  ["computing", "computer-science"], ["engineering", "engineering"],  ["medicine", "medicine"], ["medical", "medicine"], ["nursing", "nursing"], ["public health", "public-health"], ["dentistry", "dentistry"],
  ["english", "linguistics"], ["communications", "media"],
  ["biology", "biology"], ["biochemistry", "biology"], ["biotechnology", "biotechnology"],
  ["chemistry", "chemistry"], ["physics", "physics"], ["mathematics", "mathematics"], ["math", "mathematics"],
  ["psychology", "psychology"], ["education", "education"], ["history", "history"], ["music", "music"], ["arts", "arts"],
  ["art", "arts"], ["design", "design"], ["media", "media"], ["communication", "media"],
  ["architecture", "architecture"], ["philosophy", "philosophy"], ["sociology", "social-sciences"],
  ["political science", "political-science"], ["international relations", "international-relations"],
  ["environmental science", "environmental-science"], ["agriculture", "agriculture"],
];

// --- Engineering sub-discipline phrases (refinement for confirmed engineering) -
const ENG_PHRASES: [string, string][] = [
  ["chemical engineering", "chemical-engineering"],
  ["mechanical engineering", "mechanical-engineering"],
  ["software engineering", "software-engineering"],
  ["civil engineering", "civil-engineering"],
  ["electrical engineering", "electrical-engineering"],
  ["power engineering", "power-engineering"],
  ["environmental engineering", "environmental-engineering"],
  ["control engineering", "control-engineering"],
  ["materials science and engineering", "materials-engineering"],
  ["materials engineering", "materials-engineering"],
  ["biomedical engineering", "biomedical-engineering"],
  ["petroleum engineering", "petroleum-engineering"],
  ["transportation engineering", "transportation-engineering"],
  ["industrial engineering", "industrial-engineering"],
  ["manufacturing engineering", "manufacturing-engineering"],
  ["electronic engineering", "electronic-engineering"],
  ["electronics engineering", "electronic-engineering"],
  ["computer engineering", "computer-engineering"],
  ["systems engineering", "systems-engineering"],
  ["mining engineering", "mining-engineering"],
  ["structural engineering", "structural-engineering"],
  ["automotive engineering", "automotive-engineering"],
  ["geotechnical engineering", "geotechnical-engineering"],
  ["agricultural engineering", "agricultural-engineering"],
  ["nuclear engineering", "nuclear-engineering"],
  ["energy engineering", "energy-engineering"],
  ["aeronautical engineering", "aerospace-engineering"],
  ["robotics engineering", "robotics-engineering"],
  ["telecommunication engineering", "telecommunication-engineering"],
  ["water resources engineering", "water-resources-engineering"],
];
const ENG_SORTED = [...ENG_PHRASES].sort((a, b) => b[0].length - a[0].length);

// --- Medical specialty terms → medicine (refinement; skips plant pathology) ----
const MED_TERMS = [
  "oncology", "cancer", "carcinoma", "gynecology", "gynaecology", "obstetric",
  "pediatric", "paediatric", "endocrinology", "cardiology", "neurology",
  "psychiatry", "psychiatric", "dermatology", "nephrology", "hematology",
  "haematology", "immunology", "gastroenterology", "urology", "ophthalmology",
  "otolaryngology", "orthopedic", "orthopaedic", "pulmonology", "rheumatology",
  "anesthesiology", "anaesthesiology", "anesthesia", "anaesthesia", "radiology",
  "pathology", "surgery", "surgical", "surgeon", "midwifery", "pharmacy",
  "pharmacology", "physiotherapy", "physiotherapist", "epidemiology",
  "clinical medicine", "medical sciences", "medical science", "medical research",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordBoundary = (s: string) => new RegExp(`\\b${esc(s)}\\b`);

function titleTags(subject: string): string[] {
  const found = new Set<string>();
  for (const [kw, slug] of TITLE_KEYWORDS) {
    if (wordBoundary(kw).test(subject)) found.add(slug);
  }
  return [...found];
}

function strongTags(text: string): string[] {
  const found = new Set<string>();
  const t = text.toLowerCase();
  for (const [pat, slug] of STRONG) {
    if (pat.test(t)) found.add(slug);
  }
  return [...found];
}

function phraseTags(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PHRASE_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    // Capture the whole subject clause, then split on commas / "and" / "or" so
    // "majoring in Art, Communication or History" yields all three subjects.
    const subj = m[1].trim().toLowerCase();
    for (const frag of subj.split(/[,;]|\band\b|\bor\b/)) {
      const f = frag.trim();
      if (!f) continue;
      for (const [name, slug] of SUBJECT_MAP) {
        if (f.startsWith(name) || f.includes(name)) found.add(slug);
      }
    }
  }
  return [...found];
}

function refine(tags: Set<string>, title: string): void {
  const subject = subjectOf(title);
  const has = (s: string) => tags.has(s) || tags.has("ALL");
  // Engineering sub-disciplines (refine confirmed engineering records)
  if (has("engineering")) {
    for (const [phrase, slug] of ENG_SORTED) {
      if (new RegExp(`(^|[\\s(&)])${esc(phrase)}\\b`).test(subject)) tags.add(slug);
    }
  }
  // CS subfields → also ensure the parent tag
  if (tags.has("artificial-intelligence") || tags.has("data-science") || tags.has("cybersecurity")) {
    tags.add("computer-science");
  }
  // Medical specialties → medicine
  if (has("medicine") || has("dentistry") || has("nursing") || has("public-health") || has("biotechnology") || has("biology")) {
    const tl = subject;
    const isMed = MED_TERMS.some((t) => {
      if (t === "pathology" && tl.includes("plant pathology")) return false;
      return tl.includes(t);
    });
    if (isMed) tags.add("medicine");
  }
  // Biology subfields → biology parent
  if (tags.has("biochemistry") || tags.has("microbiology") || tags.has("genetics") ||
      tags.has("neuroscience") || tags.has("botany") || tags.has("zoology") || tags.has("ecology")) {
    tags.add("biology");
  }
}

async function main() {
  // Body text from wms eligibility files (keyed by sourceUrl last segment)
  const eligBySlug = new Map<string, string>();
  try {
    for (const line of readFileSync("data/wms-eligibility.jsonl", "utf8").split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line) as { slug?: string; eligibility?: string; process?: string };
      if (r.slug) eligBySlug.set(r.slug, [r.eligibility, r.process].filter(Boolean).join(" "));
    }
  } catch {
    // file absent — body tier just skips wms texts
  }
  console.log(`eligibility texts loaded: ${eligBySlug.size}`);

  const rows = await prisma.scholarship.findMany({
    where: { recordType: "SCHOLARSHIP" },
    select: { id: true, title: true, description: true, sourceUrl: true, fields: true, status: true },
  });
  console.log(`records: ${rows.length}`);

  // Only trust eligibility text when the sourceUrl slug is UNIQUE — WMS reuses
  // slugs across country editions (e.g. "china-scholarship-data-may-2019"
  // maps to 2,131 records), and a shared slug would apply one record's
  // eligibility text to all of them (wrong tags).
  const slugCount = new Map<string, number>();
  for (const r of rows) {
    const slug = r.sourceUrl?.split("/").pop();
    if (slug) slugCount.set(slug, (slugCount.get(slug) ?? 0) + 1);
  }
  const uniqueSlug = (slug?: string) => !!slug && (slugCount.get(slug) ?? 0) === 1;

  let willUpdate = 0;
  let newlyTagged = 0; // had [] → gets tags
  const samples: string[] = [];
  const suspicious: string[] = [];
  const byTag: Record<string, number> = {};

  const updates: { id: string; fields: string[] }[] = [];
  for (const r of rows) {
    let existing: string[] = [];
    try { existing = JSON.parse(r.fields) as string[]; } catch { /* [] */ }
    if (existing.includes("ALL")) continue; // open-to-all: leave as-is

    const subject = subjectOf(r.title || "");
    const slug = r.sourceUrl?.split("/").pop();
    // Parenthetical examples ("(e.g. medicine, law)") are boilerplate, not the
    // scholarship's subject — strip them before classification.
    const body = [r.description, slug && uniqueSlug(slug) ? eligBySlug.get(slug) : ""]
      .filter(Boolean)
      .join(" ")
      // Also strip exclusion clauses: "(excluding Medicine and Dentistry)"
      // means the OPPOSITE of a tag, so those fields must never be added.
      .replace(/\((?:e\.?g\.?|i\.?e\.?|such as|excluding|except|not including|other than)[^)]*\)/gi, "");

    const tags = new Set<string>(existing);
    // Title tier first — titles name the subject. Body text is only consulted
    // when the title is silent (named scholarships like "Smith Family Endowed
    // Scholarship"), so eligibility boilerplate never overrides a title match
    // or adds stray tags to a record that already has a field.
    const fromTitle = [...titleTags(subject), ...strongTags(subject)];
    const fromBody = [...phraseTags(body), ...strongTags(body)];
    for (const t of (fromTitle.length ? fromTitle : fromBody)) {
      if (validSlugs.has(t)) tags.add(t);
    }
    refine(tags, r.title || "");

    // Drop any stale/invalid tags that crept in from old imports
    for (const t of [...tags]) {
      if (!validSlugs.has(t) && t !== "ALL") tags.delete(t);
    }

    const next = [...tags].sort();
    if (JSON.stringify(next) === r.fields) continue;

    const hadNone = existing.length === 0;
    willUpdate++;
    if (hadNone) newlyTagged++;
    for (const t of next) byTag[t] = (byTag[t] ?? 0) + 1;
    if (samples.length < 25) samples.push(`${r.title.slice(0, 80)}  ->  [${next.join(", ")}]`);
    if (hadNone && suspicious.length < 15 && /(?:fund|prize|award|scholarship).{0,30}(?:pharmacy|dental|medical)/i.test(r.title)) {
      // spot-check: org names that might mislead
      suspicious.push(r.title.slice(0, 90));
    }
    updates.push({ id: r.id, fields: next });
  }

  console.log(`\nwould update: ${willUpdate} (newly tagged: ${newlyTagged})`);
  console.log("\n--- samples ---");
  for (const s of samples) console.log("  -", s);
  console.log("\n--- suspicious (org-name risk) ---");
  for (const s of suspicious) console.log("  ?", s);
  console.log("\n--- tag delta (top 25) ---");
  Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t, n]) => console.log(`  ${t.padEnd(26)} ${n}`));

  if (DUMP) {
    const fs = await import("node:fs");
    fs.writeFileSync(
      "/tmp/retag-updates.jsonl",
      updates.map((u) => JSON.stringify(u)).join("\n") + "\n"
    );
    console.log(`dumped ${updates.length} updates to /tmp/retag-updates.jsonl`);
  }

  if (DRY_RUN) {
    console.log("\ndry run — no writes");
    await prisma.$disconnect();
    return;
  }

  const CHUNK = 100;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      batch.map((u) => prisma.scholarship.update({ where: { id: u.id }, data: { fields: JSON.stringify(u.fields) } }))
    );
    done += batch.length;
    if (done % 1500 === 0 || done === updates.length) console.log(`applied ${done}/${updates.length}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
