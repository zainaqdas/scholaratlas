/* Backfill chinesescholarshipcouncil.com CN records with rich fields from the
 * detail-page crawl (data/csc-details.jsonl).
 *
 * Maps:
 *   eligibility  -> academicRequirements
 *   documents    -> requiredDocuments (DocumentKey[])
 *   steps        -> applicationSteps (JSON array)
 *   benefits     -> benefits (tuition/accommodation/stipend/insurance) + fundingType
 *   deadline     -> deadline (parsed date)
 *   ielts        -> languageRequirements JSON
 *   level        -> studyLevels (if currently empty)
 *   duration     -> duration
 *   age          -> ageRequirements
 *   fee          -> applicationFee
 *
 * Only fills fields that are currently empty.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

function mapDocuments(docs: string[]): string[] {
  const keys = new Set<string>();
  for (const d of docs) {
    const t = d.toLowerCase();
    if (/passport/.test(t)) keys.add("passport");
    else if (/transcript/.test(t)) keys.add("transcripts");
    else if (/\bcv\b|resume|curriculum vitae/.test(t)) keys.add("cv");
    else if (/motivation|statement of purpose|personal statement/.test(t)) keys.add("motivationLetter");
    else if (/recommendation|reference letter/.test(t)) keys.add("recommendationLetters");
    else if (/research proposal|study plan/.test(t)) keys.add("researchProposal");
    else if (/english|ielts|toefl|language proficiency/.test(t)) keys.add("englishProof");
    else if (/portfolio/.test(t)) keys.add("portfolio");
    else keys.add("other");
  }
  return [...keys];
}

function mapBenefits(benefits: string[]): { benefits: string[]; fundingType: string } {
  const out: string[] = [];
  let fundingType = "PARTIAL";
  const text = benefits.join(" ").toLowerCase();
  if (/tuition|fee waiver|full tuition/.test(text)) out.push("tuition");
  if (/accommodation|housing|dormitory|on-campus/.test(text)) out.push("accommodation");
  if (/stipend|allowance|living|monthly/.test(text)) out.push("stipend");
  if (/insurance|medical/.test(text)) out.push("insurance");
  if (/airfare|flight|travel/.test(text)) out.push("airfare");
  if (out.includes("tuition") && out.includes("stipend")) fundingType = "FULLY_FUNDED_STIPEND";
  else if (out.includes("tuition") && (out.includes("accommodation") || out.includes("insurance"))) fundingType = "FULLY_FUNDED";
  else if (out.includes("tuition")) fundingType = "TUITION_WAIVER";
  return { benefits: out, fundingType };
}

function mapLevel(level: string): string[] {
  const l = (level || "").toLowerCase();
  if (/bachelor|undergraduate/.test(l)) return ["Undergraduate"];
  if (/master/.test(l)) return ["Master's"];
  if (/doctoral|ph\.?d/.test(l)) return ["PhD"];
  if (/postdoctoral|post-doctoral/.test(l)) return ["Postdoctoral"];
  return [];
}

function parseDeadline(s: string): Date | null {
  if (!s) return null;
  const cleaned = s.replace(/(st|nd|rd|th),?/, ",").trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const rows = (await fs.promises.readFile("data/csc-details.jsonl", "utf8"))
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  console.log(`crawled records: ${rows.length}`);

  const byUrl = new Map<string, (typeof rows)[number]>();
  for (const r of rows) byUrl.set(r.url, r);

  const records = await prisma.scholarship.findMany({
    where: {
      countryCode: "CN",
      OR: [{ officialUrl: { contains: "chinesescholarshipcouncil" } }, { sourceUrl: { contains: "chinesescholarshipcouncil" } }],
    },
    select: { id: true, sourceUrl: true, officialUrl: true, academicRequirements: true, requiredDocuments: true, applicationSteps: true, benefits: true, fundingType: true, deadline: true, languageRequirements: true, studyLevels: true, duration: true, ageRequirements: true, applicationFee: true, status: true },
  });
  console.log(`CSC records in DB: ${records.length}`);

  let matched = 0;
  const updates: any[] = [];
  for (const rec of records) {
    const crawl = byUrl.get(rec.sourceUrl || "") || byUrl.get(rec.officialUrl || "");
    if (!crawl) continue;
    matched++;

    const data: any = {};

    if (!rec.academicRequirements && crawl.eligibility) data.academicRequirements = crawl.eligibility;

    if ((!rec.requiredDocuments || rec.requiredDocuments === "[]") && crawl.documents?.length) {
      data.requiredDocuments = JSON.stringify(mapDocuments(crawl.documents));
    }

    if ((!rec.applicationSteps || rec.applicationSteps === "[]") && crawl.steps?.length) {
      const steps = crawl.steps.filter((s: string) => !/^(faqs?|can|do|how|what|why|is|are|when|where)\b/i.test(s));
      if (steps.length) data.applicationSteps = JSON.stringify(steps);
    }

    if ((!rec.benefits || rec.benefits === "[]") && crawl.benefits?.length) {
      const { benefits, fundingType } = mapBenefits(crawl.benefits);
      if (benefits.length) {
        data.benefits = JSON.stringify(benefits);
        data.fundingType = fundingType;
      }
    }

    if (!rec.deadline && crawl.deadline) {
      const d = parseDeadline(crawl.deadline);
      if (d) data.deadline = d;
    }

    if ((!rec.languageRequirements || rec.languageRequirements === "[]" || rec.languageRequirements === "{}") && crawl.ielts !== undefined && crawl.ielts !== null) {
      data.languageRequirements = JSON.stringify({
        ielts: crawl.ielts === false,
        toefl: false,
        noIelts: crawl.ielts === true,
        altProof: false,
        notRequired: crawl.ielts === true,
      });
    }

    if ((!rec.studyLevels || rec.studyLevels === "[]") && crawl.level) {
      const levels = mapLevel(crawl.level);
      if (levels.length) data.studyLevels = JSON.stringify(levels);
    }

    if (!rec.duration && crawl.duration) data.duration = crawl.duration;
    if (!rec.ageRequirements && crawl.age) data.ageRequirements = crawl.age;
    if (!rec.applicationFee && crawl.fee) data.applicationFee = crawl.fee;

    if (Object.keys(data).length) updates.push(prisma.scholarship.update({ where: { id: rec.id }, data }));
  }
  console.log(`matched: ${matched}, updates: ${updates.length}`);

  const CHUNK = 100;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await prisma.$transaction(updates.slice(i, i + CHUNK));
    done += Math.min(CHUNK, updates.length - i);
    if (done % 200 === 0 || done === updates.length) console.log(`applied ${done}/${updates.length}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
