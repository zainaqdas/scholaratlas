/* Backfill `fields` (field slugs) for scholarship records that currently have
 * none, using a layered classifier:
 *   1. Title keyword match (broad contains — titles are specific)
 *   2. Explicit phrase match in the eligibility/process text:
 *      "major in X", "degree in X", "studying X", "pursuing X", "field of X"
 *   3. Strong subject keywords with word boundaries in the text
 *      (avoids boilerplate false positives like "financial" → finance)
 *
 * Only assigns fields when the source text actually names the subject — never
 * invented. Records whose title/text never mention a subject stay "Not
 * specified" (honest).
 *
 * Usage:
 *   npx tsx scripts/backfill-fields.ts --dry-run
 *   npx tsx scripts/backfill-fields.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// --- Field keywords (title match — specific, low false-positive risk) --------
const TITLE_KEYWORDS: [string, string][] = [
  ["computer science", "computer-science"], ["software", "computer-science"],
  ["computer", "computer-science"], ["information technology", "computer-science"],
  ["informatics", "computer-science"], ["computing", "computer-science"],
  ["artificial intelligence", "artificial-intelligence"], ["machine learning", "artificial-intelligence"],
  ["data science", "data-science"], ["big data", "data-science"], ["data analytics", "data-science"],
  ["cybersecurity", "cybersecurity"], ["cyber security", "cybersecurity"], ["information security", "cybersecurity"],
  ["engineering", "engineering"], ["automation", "engineering"], ["mechanical", "engineering"],
  ["civil engineering", "engineering"], ["electrical", "engineering"], ["chemical engineering", "engineering"],
  ["materials", "engineering"], ["vehicle", "engineering"], ["aerospace", "engineering"],
  ["robotics", "engineering"], ["telecommunication", "engineering"], ["manufacturing", "engineering"],
  ["biomedical engineering", "biotechnology"], ["bioengineering", "biotechnology"], ["biotechnology", "biotechnology"],
  ["biological", "biology"], ["biology", "biology"], ["ecology", "biology"], ["life science", "biology"],
  ["neuroscience", "biology"], ["genetics", "biology"], ["microbiology", "biology"],
  ["clinical medicine", "medicine"], ["medicine", "medicine"], ["medical", "medicine"],
  ["pharmacology", "medicine"], ["pharmacy", "medicine"], ["pharmaceutical", "medicine"], ["dental", "medicine"],
  ["nursing", "nursing"], ["public health", "public-health"],
  ["chemistry", "chemistry"], ["physics", "physics"], ["mathematics", "mathematics"], ["math", "mathematics"],
  ["statistics", "mathematics"], ["environmental", "environmental-science"], ["environment", "environmental-science"],
  ["business administration", "business"], ["business", "business"], ["management", "business"],
  ["mba", "business"], ["commerce", "business"], ["entrepreneurship", "business"],
  ["marketing", "marketing"], ["advertising", "marketing"], ["accounting", "accounting"],
  ["finance", "finance"], ["financial", "finance"], ["economics", "economics"], ["economy", "economics"],
  ["law", "law"], ["legal", "law"], ["political", "political-science"], ["public administration", "political-science"],
  ["international politics", "political-science"], ["international relations", "international-relations"],
  ["international trade", "international-relations"], ["diplomacy", "international-relations"],
  ["psychology", "psychology"], ["education", "education"], ["teaching", "education"],
  ["agriculture", "agriculture"], ["agronomy", "agriculture"], ["food science", "agriculture"],
  ["forestry", "agriculture"], ["horticulture", "agriculture"],
  ["architecture", "architecture"], ["urban planning", "architecture"], ["landscape", "architecture"],
  ["fine arts", "arts"], ["art", "arts"], ["design", "design"], ["fashion", "design"],
  ["media", "media"], ["journalism", "media"], ["communication", "media"], ["film", "media"],
  ["tourism", "tourism"], ["hotel", "tourism"], ["hospitality", "tourism"],
  ["english", "linguistics"], ["japanese", "linguistics"], ["chinese language", "linguistics"],
  ["linguistics", "linguistics"], ["translation", "linguistics"],
  ["history", "history"], ["philosophy", "philosophy"], ["music", "music"],
  ["sports", "sports-science"], ["athletic", "sports-science"], ["physical education", "sports-science"],
];

// --- Strong subject keywords for body text (word boundaries) ------------------
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
  [/\bmedicine\b/, "medicine"], [/\bmedical\b/, "medicine"], [/\bclinical\b/, "medicine"],
  [/\bdental\b/, "medicine"], [/\bveterinary\b/, "medicine"], [/\bpharmacy\b/, "medicine"], [/\bpharmacolog/, "medicine"],
  [/\bnursing\b/, "nursing"], [/\bpublic health\b/, "public-health"], [/\bhealthcare\b/, "public-health"],
  [/\bbiotechnology\b/, "biotechnology"], [/\bbiomedical\b/, "biotechnology"],
  [/\bbiology\b/, "biology"], [/\bbiological\b/, "biology"],
  [/\bneuroscience\b/, "biology"], [/\bgenetics\b/, "biology"], [/\bmicrobiology\b/, "biology"], [/\bbiochemistr/, "biology"],
  [/\bchemistry\b/, "chemistry"], [/\bchemical\b/, "chemistry"],
  [/\bphysics\b/, "physics"], [/\bastronomy\b/, "physics"], [/\bquantum\b/, "physics"],
  [/\bmathematics\b/, "mathematics"], [/\bstatistics\b/, "mathematics"], [/\bstatistical\b/, "mathematics"],
  [/\bgeolog/, "natural-sciences"], [/\bearth science\b/, "natural-sciences"], [/\bgeography\b/, "natural-sciences"],
  [/\benvironmental science\b/, "environmental-science"], [/\bclimate\b/, "environmental-science"], [/\bsustainab/, "environmental-science"],
  [/\bbusiness administration\b/, "business"], [/\bmanagement\b/, "business"], [/\bmba\b/, "business"],
  [/\bentrepreneurship\b/, "business"], [/\bcommerce\b/, "business"],
  [/\baccounting\b/, "accounting"], [/\baudit/, "accounting"],
  [/\bfinance\b/, "finance"], [/\bbanking\b/, "finance"], [/\binvestment\b/, "finance"],
  [/\beconomics\b/, "economics"], [/\beconometrics\b/, "economics"],
  [/\bmarketing\b/, "marketing"], [/\badvertising\b/, "marketing"],
  [/\blaw\b/, "law"], [/\blegal\b/, "law"], [/\bllm\b/, "law"], [/\bcriminology\b/, "law"],
  [/\bpolitical science\b/, "political-science"], [/\bpolitics\b/, "political-science"], [/\bpublic policy\b/, "political-science"],
  [/\binternational relations\b/, "international-relations"], [/\bdiplomacy\b/, "international-relations"],
  [/\binternational development\b/, "international-relations"],
  [/\bsociology\b/, "social-sciences"], [/\banthropology\b/, "social-sciences"], [/\bsocial work\b/, "social-sciences"],
  [/\bhumanities\b/, "social-sciences"], [/\bsocial sciences?\b/, "social-sciences"],
  [/\bpsychology\b/, "psychology"], [/\bbehavioral\b/, "psychology"], [/\bcognitive\b/, "psychology"],
  [/\beducation\b/, "education"], [/\bteaching\b/, "education"],
  [/\bagriculture\b/, "agriculture"], [/\bagronomy\b/, "agriculture"], [/\bhorticulture\b/, "agriculture"],
  [/\bforestry\b/, "agriculture"], [/\bfood science\b/, "agriculture"],
  [/\barchitecture\b/, "architecture"], [/\burban planning\b/, "architecture"], [/\blandscape\b/, "architecture"],
  [/\bfine arts\b/, "arts"], [/\bperforming arts\b/, "arts"], [/\bvisual arts\b/, "arts"], [/\btheatre\b/, "arts"],
  [/\bdesign\b/, "design"], [/\bfashion\b/, "design"],
  [/\bjournalism\b/, "media"], [/\bmedia\b/, "media"], [/\bcommunication\b/, "media"], [/\bfilm\b/, "media"],
  [/\bmusic\b/, "music"],
  [/\bhistory\b/, "history"],
  [/\bphilosophy\b/, "philosophy"],
  [/\blinguistics\b/, "linguistics"], [/\btranslation\b/, "linguistics"],
  [/\btourism\b/, "tourism"], [/\bhospitality\b/, "tourism"],
  [/\bsports?\b/, "sports-science"], [/\bathletic\b/, "sports-science"],
];

// Explicit subject phrases in body text ("major in X", "degree in X"…)
const PHRASE_RE =
  /(?:major(?:ing)? in|degree in|studying|pursuing|enrolled in|field of)\s+([a-z &]+?)(?:[,.;]| and |\s+at\b|$)/i;
const SUBJECT_MAP: [string, string][] = [
  ["accounting", "accounting"], ["finance", "finance"], ["economics", "economics"], ["business", "business"],
  ["marketing", "marketing"], ["law", "law"], ["legal", "law"], ["computer science", "computer-science"],
  ["computing", "computer-science"], ["engineering", "engineering"], ["medicine", "medicine"], ["medical", "medicine"],
  ["biology", "biology"], ["chemistry", "chemistry"], ["physics", "physics"], ["mathematics", "mathematics"], ["math", "mathematics"],
  ["psychology", "psychology"], ["education", "education"], ["history", "history"], ["music", "music"], ["arts", "arts"],
  ["art", "arts"], ["design", "design"], ["media", "media"], ["communication", "media"], ["nursing", "nursing"],
  ["architecture", "architecture"], ["philosophy", "philosophy"], ["sociology", "social-sciences"],
  ["political science", "political-science"], ["international relations", "international-relations"],
  ["environmental science", "environmental-science"], ["agriculture", "agriculture"],
];

function titleFields(title: string): string[] {
  const t = title.toLowerCase();
  const found = new Set<string>();
  for (const [kw, slug] of TITLE_KEYWORDS) {
    // Word-boundary match: avoids substring false positives like "art" in
    // "SARTHI" while still catching "art", "arts", "math", "law", etc.
    if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) found.add(slug);
  }
  return [...found];
}

function phraseFields(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PHRASE_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const subj = m[1].trim().toLowerCase();
    for (const [name, slug] of SUBJECT_MAP) {
      if (subj.startsWith(name) || subj.includes(name)) found.add(slug);
    }
  }
  return [...found];
}

function strongFields(text: string): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const [pat, slug] of STRONG) {
    if (pat.test(t)) found.add(slug);
  }
  return [...found];
}

function classify(title: string, text: string): string[] {
  const fromTitle = titleFields(title);
  if (fromTitle.length) return fromTitle;
  const fromPhrase = phraseFields(text);
  if (fromPhrase.length) return fromPhrase;
  return strongFields(text);
}

async function main() {
  // Load wms eligibility text keyed by slug (source URL last segment)
  const eligBySlug = new Map<string, { eligibility?: string; process?: string }>();
  try {
    for (const line of readFileSync("data/wms-eligibility.jsonl", "utf8").split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line) as { slug?: string; eligibility?: string; process?: string };
      if (r.slug) eligBySlug.set(r.slug, r);
    }
  } catch {
    // no file — text tier will just be skipped for wms
  }
  console.log(`eligibility texts loaded: ${eligBySlug.size}`);

  const records = await prisma.scholarship.findMany({
    where: {
      status: "ACTIVE",
      recordType: "SCHOLARSHIP",
      fields: "[]",
    },
    select: { id: true, title: true, sourceUrl: true, fields: true },
  });
  console.log(`records with no fields: ${records.length}`);

  const updates: { id: string; fields: string[] }[] = [];
  let covered = 0;
  for (const rec of records) {
    const slug = rec.sourceUrl?.split("/").pop();
    const text = slug ? (eligBySlug.get(slug)?.eligibility || "") + " " + (eligBySlug.get(slug)?.process || "") : "";
    const fields = classify(rec.title || "", text);
    if (fields.length) {
      updates.push({ id: rec.id, fields });
      covered++;
    }
  }
  console.log(`classifiable: ${covered}/${records.length} (${Math.round((100 * covered) / records.length)}%)`);

  if (DRY_RUN) {
    console.log("dry run — no writes");
    await prisma.$disconnect();
    return;
  }

  const CHUNK = 100;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = updates.slice(i, i + CHUNK);
    await prisma.$transaction(batch.map((u) => prisma.scholarship.update({ where: { id: u.id }, data: { fields: JSON.stringify(u.fields) } })));
    done += batch.length;
    if (done % 800 === 0 || done === updates.length) console.log(`applied ${done}/${updates.length}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
