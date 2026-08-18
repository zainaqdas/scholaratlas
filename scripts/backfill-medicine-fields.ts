// Backfill: tag ACTIVE scholarships whose titles are clearly medical
// subspecialties (oncology, gynecology, anesthesiology, radiology, midwifery,
// etc.) with the "medicine" field, so the Medicine filter and /fields/medicine
// page surface them.
//
// Only unambiguous PROGRAM-level medical terms are used — generic words like
// "medicine"/"medical"/"clinical" are excluded because they appear in
// university names (e.g. "Sanquan Medical College") rather than describing the
// scholarship itself. Records already tagged (medicine / ALL / nursing / biology)
// are left untouched.
//
// False-positive guards:
// - For titles with an em-dash separator ("Program — University (Level)"), only
//   the PROGRAM part is matched, so terms inside university names (e.g. "China
//   Pharmaceutical University") never trigger a tag.
// - "pharmaceutical" only counts in the program part (a no-dash title like
//   "Douglas Pharmaceuticals Prize…" is a company name, not a subject).
// - "pathology" does not count for "Plant Pathology" (agriculture, not medicine).
// - "healthcare"/"health care" are deliberately NOT in the list — they surface
//   policy/leadership fellowships (e.g. CMU Heinz, Imperial Business School)
//   that are not medical programs.
//
// Usage: npx tsx scripts/backfill-medicine-fields.ts [--dry-run]
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

const EM_DASH = "\u2014";

// Program-level medical terms that make a title unambiguously medical.
const MED_TERMS = [
  "oncology", "cancer", "carcinoma", "gynecology", "gynaecology", "obstetric",
  "pediatric", "paediatric", "endocrinology", "cardiology", "neurology",
  "psychiatry", "psychiatric", "dermatology", "nephrology", "hematology",
  "haematology", "immunology", "gastroenterology", "urology", "ophthalmology",
  "otolaryngology", "orthopedic", "orthopaedic", "pulmonology", "rheumatology",
  "anesthesiology", "anaesthesiology", "anesthesia", "anaesthesia", "radiology",
  "pathology", "surgery", "surgical", "surgeon", "midwifery", "pharmacy",
  "pharmacology", "pharmaceutical", "dentistry", "dental", "physiotherapy",
  "physiotherapist", "rehabilitation medicine", "epidemiology", "biomedical",
  "neuroscience", "veterinary", "public health", "clinical medicine",
  "medical sciences", "medical science", "medicine prize", "medical research",
  "medical scholarship",
];

const ALREADY_TAGGED = new Set(["medicine", "ALL", "nursing", "biology", "biotechnology", "public-health", "neuroscience"]);

async function main() {
  const rows = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
    select: { id: true, title: true, fields: true },
  });

  let tagged = 0;
  const samples: string[] = [];
  for (const r of rows) {
    const tl = r.title.toLowerCase();
    // Match against the program part only when an em-dash separates "Program — University".
    const dashIdx = tl.indexOf(EM_DASH);
    const subject = dashIdx >= 0 ? tl.slice(0, dashIdx) : tl;
    const matchesTerm = (t: string): boolean => {
      if (t === "pharmaceutical" && dashIdx < 0) return false; // company-name usage
      if (t === "pathology" && tl.includes("plant pathology")) return false;
      return subject.includes(t);
    };
    if (!MED_TERMS.some(matchesTerm)) continue;
    let fieldsArr: string[] = [];
    try { fieldsArr = JSON.parse(r.fields) as string[]; } catch { /* keep [] */ }
    if (fieldsArr.some((f) => ALREADY_TAGGED.has(f))) continue;
    const next = JSON.stringify([...new Set([...fieldsArr, "medicine"])]);
    if (next === r.fields) continue;
    if (!DRY_RUN) {
      await prisma.scholarship.update({ where: { id: r.id }, data: { fields: next } });
    }
    tagged++;
    if (samples.length < 10) samples.push(r.title);
  }

  console.log(`${DRY_RUN ? "[dry-run] would tag" : "tagged"}: ${tagged} records`);
  for (const s of samples) console.log("  -", s.slice(0, 85));
}

main().finally(() => prisma.$disconnect());
