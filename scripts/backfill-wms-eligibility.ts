/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Fill eligibility-derived fields for wemakescholars records from the crawled
// "Eligibility Criteria" + "Application Process" free-text sections
// (data/wms-eligibility.jsonl).
//
// The wms source itself writes these sections (e.g. "Applicants must: Be a
// citizen of India…", "Students must submit an application form…"). We derive:
//   - academicRequirements : the eligibility text verbatim (source's own words)
//   - requiredDocuments    : DocumentKey[] from keyword detection in the text
//   - applicationSteps     : the process text split into ordered steps
//   - languageRequirements : { ielts, toefl, notRequired, ... } from keywords
//
// Only keywords actually present in the source text are set — nothing invented.
//
// Usage:
//   npm run backfill:wms-eligibility -- --dry-run
//   npm run backfill:wms-eligibility
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function detectDocuments(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  if (/\btranscripts?\b|academic records|mark sheets?|grade cards?\b|transcript/i.test(lower)) found.add("transcripts");
  if (/\bcv\b|resume|curriculum vitae/i.test(lower)) found.add("cv");
  if (/\bmotivation letter\b|statement of purpose|purpose letter|cover letter/i.test(lower)) found.add("motivationLetter");
  if (/\brecommendation letters?\b|reference letters?\b|letters? of (recommendation|reference)/i.test(lower)) found.add("recommendationLetters");
  if (/\bpersonal statement\b|personal essay/i.test(lower)) found.add("personalStatement");
  if (/\bresearch proposal\b|proposal/i.test(lower)) found.add("researchProposal");
  if (/\bportfolio\b/i.test(lower)) found.add("portfolio");
  if (/\bpassport\b/i.test(lower)) found.add("passport");
  return [...found];
}

function detectLanguage(text: string): Record<string, boolean> {
  const lower = text.toLowerCase();
  const out: Record<string, boolean> = {};
  const mentionsEnglish = /\benglish\b|english language|english proficiency/i.test(lower);
  if (/\bielts\b/i.test(lower)) out.ielts = true;
  if (/\btoefl\b/i.test(lower)) out.toefl = true;
  if (mentionsEnglish && !out.ielts && !out.toefl) out.altProof = true;
  if (/english (is )?not required|no english (requirement|test)|language (is )?not required/i.test(lower)) out.notRequired = true;
  return out;
}

// Split process text into ordered steps at sentence boundaries (and "step n",
// numbered lists). Keep at most 8 steps.
function detectSteps(processText: string): string[] | null {
  const text = processText.trim();
  if (text.length < 15) return null;
  // numbered/bulleted steps
  const numbered = text.match(/(?:^|[.;])\s*(?:step\s*\d+\s*[:.)-]|\d+[.)]\s+)/gi);
  let steps: string[] = [];
  if (numbered && numbered.length >= 2) {
    steps = text
      .split(/(?:^|[.;])\s*(?:step\s*\d+\s*[:.)-]|\d+[.)]\s+)/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
  } else {
    // split on sentence boundaries
    steps = text
      .split(/(?<=[.;!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }
  if (steps.length < 1) return null;
  return steps.slice(0, 8).map((s) => (s.endsWith(".") ? s : s + "."));
}

async function main() {
  const rows: { slug: string; eligibility?: string; process?: string }[] = [];
  try {
    const raw = readFileSync("data/wms-eligibility.jsonl", "utf-8");
    for (const line of raw.split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { slug: string; eligibility?: string; process?: string; err?: string };
      if (r.err) continue;
      rows.push({ slug: r.slug, eligibility: r.eligibility, process: r.process });
    }
  } catch {
    console.error("Could not read data/wms-eligibility.jsonl — aborting.");
    process.exit(1);
  }
  console.log(`Crawled eligibility data: ${rows.length} records`);

  // slug -> derived fields
  const bySlug = new Map<string, { academic?: string; docs: string[]; lang: Record<string, boolean>; steps: string[] | null }>();
  let nElig = 0, nDocs = 0, nLang = 0, nSteps = 0;
  for (const r of rows) {
    const text = `${r.eligibility ?? ""} ${r.process ?? ""}`.trim();
    if (!text) continue;
    const docs = detectDocuments(text);
    const lang = detectLanguage(text);
    const steps = r.process ? detectSteps(r.process) : null;
    if (r.eligibility) nElig++;
    if (docs.length) nDocs++;
    if (Object.keys(lang).length) nLang++;
    if (steps) nSteps++;
    bySlug.set(r.slug, {
      academic: r.eligibility,
      docs,
      lang,
      steps,
    });
  }
  console.log(
    `Derived: eligibility=${nElig} documents=${nDocs} language=${nLang} steps=${nSteps} (of ${rows.length})`,
  );

  // wms records with empty requiredDocuments AND empty applicationSteps (the
  // fields we're filling). academicRequirements is free-text — fill when empty.
  const records = await prisma.scholarship.findMany({
    where: {
      sourceUrl: { contains: "wemakescholars" },
      OR: [
        { requiredDocuments: "[]" },
        { applicationSteps: "[]" },
        { academicRequirements: null },
        { academicRequirements: "" },
      ],
    },
    select: { id: true, sourceUrl: true, academicRequirements: true, requiredDocuments: true, applicationSteps: true, languageRequirements: true },
  });
  console.log(`wms records with missing fields: ${records.length}`);

  interface Update {
    id: string;
    academicRequirements?: string;
    requiredDocuments?: string;
    applicationSteps?: string;
    languageRequirements?: string;
  }
  const updates: Update[] = [];
  let nAcademic = 0, nRequired = 0, nAppSteps = 0, nLangUpd = 0;

  for (const rec of records) {
    if (!rec.sourceUrl) continue;
    const slug = rec.sourceUrl.split("/").pop();
    if (!slug) continue;
    const info = bySlug.get(slug);
    if (!info) continue;
    const u: Update = { id: rec.id };
    if (!rec.academicRequirements && info.academic) {
      u.academicRequirements = info.academic;
      nAcademic++;
    }
    if (rec.requiredDocuments === "[]" && info.docs.length) {
      u.requiredDocuments = JSON.stringify(info.docs);
      nRequired++;
    }
    if (rec.applicationSteps === "[]" && info.steps) {
      u.applicationSteps = JSON.stringify(info.steps);
      nAppSteps++;
    }
    if (Object.keys(info.lang).length) {
      const existing = (() => {
        try { return JSON.parse(rec.languageRequirements) as Record<string, boolean>; }
        catch { return {}; }
      })();
      const merged = { ...existing, ...info.lang };
      if (Object.keys(merged).length > Object.keys(existing).length || Object.keys(info.lang).some((k) => !existing[k])) {
        u.languageRequirements = JSON.stringify(merged);
        nLangUpd++;
      }
    }
    if (Object.keys(u).length > 1) updates.push(u);
  }

  console.log(
    `To update: ${updates.length} records (academic=${nAcademic}, documents=${nRequired}, steps=${nAppSteps}, language=${nLangUpd})`,
  );

  if (DRY_RUN) {
    for (const u of updates.slice(0, 6)) {
      console.log(
        `  [dry-run] ${u.id} academic=${u.academicRequirements ? "y" : "-"} docs=${u.requiredDocuments ?? "-"} steps=${u.applicationSteps ? "y" : "-"} lang=${u.languageRequirements ?? "-"}`,
      );
    }
    return;
  }

  let applied = 0;
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({
          where: { id: u.id },
          data: { ...u, updatedAt: new Date() },
        }),
      ),
    );
    applied += batch.length;
    console.log(`Applied ${applied}/${updates.length}...`);
  }
  console.log(`Done: updated ${applied} records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
