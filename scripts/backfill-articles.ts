// Backfills the curated articles from prisma/seed.ts into the database.
// Reads the ARTICLES array directly out of seed.ts so the content can never
// drift from what a fresh seed would write. Run with the target DATABASE_URL
// (and TURSO_AUTH_TOKEN for remote Turso databases):
//
//   DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx scripts/backfill-articles.ts
//
// Idempotent: uses upsert on slug, so re-running only fills gaps.
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

// Match the seed's publishedAt convention: publishedDaysAgo days back at 9:00.
function daysFromNow(days: number, hour = 23, minute = 59): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Pull the `const ARTICLES = [ ... ]` literal out of seed.ts (plain JS object
// literals — no TS syntax — so it evaluates as-is).
function loadSeedArticles(): Array<{
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  readingTime: number;
  publishedDaysAgo: number;
  body: string;
  related: string[];
}> {
  const seedPath = path.resolve(__dirname, "../prisma/seed.ts");
  const raw = fs.readFileSync(seedPath, "utf8");
  const marker = "const ARTICLES = [";
  const start = raw.indexOf(marker);
  if (start === -1) throw new Error("ARTICLES array not found in seed.ts");
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "[") depth++;
    else if (raw[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Could not find the end of the ARTICLES array");
  // Slice from the start of the array (include the opening "[") through the
  // matching closing bracket.
  const literal = raw.slice(start + "const ARTICLES = ".length, end).trim();
  return new Function(`return ${literal}`)();
}

async function main() {
  const articles = loadSeedArticles();
  console.log(`Loaded ${articles.length} articles from seed.ts`);

  let created = 0;
  let skipped = 0;
  for (const a of articles) {
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.article.create({
      data: {
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        category: a.category,
        author: a.author,
        readingTime: a.readingTime,
        publishedAt: daysFromNow(-a.publishedDaysAgo, 9, 0),
        body: a.body,
        relatedScholarships: JSON.stringify(a.related),
      },
    });
    created++;
    console.log(`  + ${a.slug}`);
  }

  const total = await prisma.article.count();
  console.log(`Done: ${created} created, ${skipped} already present. Total articles: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
