// Normalize orphan/capitalized field tags so every stored field value is a
// canonical lowercase slug (or "ALL"). Imports occasionally wrote display-name
// tags ("Business", "Medicine", "Environmental Science", "Dentistry", ...)
// which no FIELDS constant matched — those records were invisible on field
// pages and in the field filter. This maps them to their slug form.
//
// Usage: npx tsx scripts/normalize-field-tags.ts [--dry-run]
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// display-name tag -> canonical slug
const TAG_MAP: Record<string, string> = {
  Business: "business",
  Engineering: "engineering",
  Mathematics: "mathematics",
  Science: "natural-sciences",
  Economics: "economics",
  "Political Science": "political-science",
  Medicine: "medicine",
  Energy: "energy",
  "Environmental Science": "environmental-science",
  Statistics: "statistics",
  Classics: "classics",
  Humanities: "humanities",
  "International Relations": "international-relations",
  Psychology: "psychology",
  "Computer Science": "computer-science",
  "Data Science": "data-science",
  Law: "law",
  Linguistics: "linguistics",
  Agriculture: "agriculture",
  Architecture: "architecture",
  Design: "design",
  Dentistry: "dentistry",
};

async function main() {
  const rows = await prisma.scholarship.findMany({
    where: { recordType: "SCHOLARSHIP" },
    select: { id: true, fields: true },
  });

  let updated = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    let arr: string[] = [];
    try {
      arr = JSON.parse(r.fields) as string[];
    } catch {
      continue;
    }
    if (!arr.some((f) => TAG_MAP[f])) continue;
    const next = JSON.stringify(
      [...new Set(arr.map((f) => TAG_MAP[f] ?? f))]
    );
    if (next === r.fields) continue;
    if (!DRY_RUN) {
      await prisma.scholarship.update({ where: { id: r.id }, data: { fields: next } });
    }
    updated++;
    for (const f of arr) if (TAG_MAP[f]) seen.add(f);
  }

  console.log(`${DRY_RUN ? "[dry-run] would fix" : "fixed"}: ${updated} records`);
  console.log("tag kinds replaced:", [...seen].sort().join(", ") || "(none)");
}

main().finally(() => prisma.$disconnect());
