/* Backfill CN (CUCAS) scholarship records with rich fields from the
 * CUCAS detail-page crawl (data/cucas-details.jsonl).
 *
 * Maps:
 *   programInfo.duration        -> duration
 *   programInfo.tuition         -> amount ("Tuition: ¥ X Per Year") + currency CNY
 *   applicationFee              -> applicationFee
 *   eligibility (cleaned)       -> academicRequirements (+ ageRequirements when present)
 *   steps                       -> applicationSteps (JSON array)
 *   documents                   -> requiredDocuments (DocumentKey[])
 *   teaching language           -> languageRequirements JSON
 *   coverage.include            -> benefits (tuition/accommodation/stipend) + fundingType
 *
 * Only fills fields that are currently empty (except benefits/amount/fundingType
 * which are refreshed from the live crawl when the crawl has data).
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

const normUrl = (u: string) => u.replace(/&lang=en$/, "").trim();

function mapDegreeToLevels(degree: string): string[] {
  switch ((degree || "").toLowerCase()) {
    case "bachelor":
      return ["Undergraduate"];
    case "master":
      return ["Master's"];
    case "doctoral":
      return ["PhD"];
    case "non-degree":
      return ["Short Course"];
    default:
      return [];
  }
}

function cleanEligibility(text: string): string {
  const m = text.match(/\s*\.shipIcon_class|CSCA Mock Test/);
  if (m) text = text.slice(0, m.index);
  return text.trim();
}

function extractAgeRequirement(text: string): string | null {
  const m = text.match(/Age\s*Limits?\s*[^.]*\d+\s*(?:for|to)\s*[^.]*\./i);
  return m ? m[0].trim() : null;
}

function mapDocuments(docs: string[]): string[] {
  const keys = new Set<string>();
  for (const d of docs) {
    const t = d.toLowerCase();
    if (/passport|photocopy of.*passport/.test(t)) keys.add("passport");
    else if (/transcript/.test(t)) keys.add("transcripts");
    else if (/\bcv\b|resume|curriculum vitae/.test(t)) keys.add("cv");
    else if (/motivation|statement of purpose|personal statement/.test(t)) keys.add("motivationLetter");
    else if (/recommendation|reference letter/.test(t)) keys.add("recommendationLetters");
    else if (/research proposal/.test(t)) keys.add("researchProposal");
    else if (/english|ielts|toefl/.test(t)) keys.add("englishProof");
    else if (/portfolio/.test(t)) keys.add("portfolio");
    else keys.add("other");
  }
  return [...keys];
}

function mapCoverage(include: string[]): { benefits: string[]; fundingType: string } {
  const benefits: string[] = [];
  let fundingType = "PARTIAL";
  const inc = new Set(include || []);
  if (inc.has("Tuition")) benefits.push("tuition");
  if (inc.has("Accommodation")) benefits.push("accommodation");
  if (inc.has("Living Allowance")) benefits.push("stipend");
  if (benefits.includes("tuition") && benefits.includes("stipend")) fundingType = "FULLY_FUNDED_STIPEND";
  else if (benefits.includes("tuition") && benefits.includes("accommodation")) fundingType = "FULLY_FUNDED";
  else if (benefits.includes("tuition")) fundingType = "TUITION_WAIVER";
  return { benefits, fundingType };
}

function mapLanguage(teachingLang: string): string {
  const lang = (teachingLang || "").toLowerCase();
  if (lang.startsWith("chinese")) {
    // Chinese-medium instruction: English tests genuinely not required.
    return JSON.stringify({ ielts: false, toefl: false, noIelts: true, altProof: false, notRequired: true });
  }
  // English / bilingual / other: test requirements not specified on the page.
  return "";
}

async function main() {
  const rows = (await fs.promises.readFile("data/cucas-details.jsonl", "utf8"))
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  console.log(`crawled records: ${rows.length}`);

  const byUrl = new Map<string, (typeof rows)[number]>();
  for (const r of rows) byUrl.set(normUrl(r.url), r);

  const records = await prisma.scholarship.findMany({
    where: { countryCode: "CN", officialUrl: { contains: "cucas" } },
    select: { id: true, officialUrl: true, studyLevels: true, fields: true, deadline: true, duration: true, applicationFee: true, academicRequirements: true, applicationSteps: true, requiredDocuments: true, languageRequirements: true, benefits: true, amount: true, currency: true, fundingType: true, ageRequirements: true },
  });
  console.log(`CN CUCAS records in DB: ${records.length}`);

  let matched = 0;
  const updates: any[] = [];
  for (const rec of records) {
    const crawl = byUrl.get(normUrl(rec.officialUrl!));
    if (!crawl) continue;
    matched++;

    const data: any = {};

    // duration
    if (!rec.duration && crawl.programInfo?.duration) data.duration = crawl.programInfo.duration;

    // application fee
    if (!rec.applicationFee && crawl.applicationFee) data.applicationFee = crawl.applicationFee;

    // eligibility -> academic requirements + age
    const elig = crawl.eligibility ? cleanEligibility(crawl.eligibility) : "";
    if (!rec.academicRequirements && elig.length > 20) data.academicRequirements = elig;
    const age = elig ? extractAgeRequirement(elig) : null;
    if (!rec.ageRequirements && age) data.ageRequirements = age;

    // application steps
    if ((!rec.applicationSteps || rec.applicationSteps === "[]") && crawl.steps?.length) {
      data.applicationSteps = JSON.stringify(crawl.steps);
    }

    // required documents
    if ((!rec.requiredDocuments || rec.requiredDocuments === "[]") && crawl.documents?.length) {
      data.requiredDocuments = JSON.stringify(mapDocuments(crawl.documents));
    }

    // language requirements (teaching language)
    if ((!rec.languageRequirements || rec.languageRequirements === "[]" || rec.languageRequirements === "{}") && crawl.programInfo?.["teaching language"]) {
      const lang = mapLanguage(crawl.programInfo["teaching language"]);
      if (lang) data.languageRequirements = lang;
    }

    // benefits + funding + amount refreshed from the live crawl
    if (crawl.coverage?.include?.length) {
      const { benefits, fundingType } = mapCoverage(crawl.coverage.include);
      data.benefits = JSON.stringify(benefits);
      data.fundingType = fundingType;
    }
    if (crawl.programInfo?.tuition) {
      data.amount = `Tuition: ${crawl.programInfo.tuition}`;
      data.currency = "CNY";
    }

    if (Object.keys(data).length) updates.push(prisma.scholarship.update({ where: { id: rec.id }, data }));
  }
  console.log(`matched: ${matched}, updates: ${updates.length}`);

  // batch in chunks
  const CHUNK = 100;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await prisma.$transaction(updates.slice(i, i + CHUNK));
    done += Math.min(CHUNK, updates.length - i);
    if (done % 400 === 0 || done === updates.length) console.log(`applied ${done}/${updates.length}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
