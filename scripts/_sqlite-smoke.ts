import { prisma } from "../src/lib/prisma";
async function main() {
  // seed a country + two scholarships with mixed case
  await prisma.country.upsert({ where: { code: "DE" }, update: {}, create: { code: "DE", name: "Germany" } });
  await prisma.scholarship.createMany({
    data: [
      { slug: "smoke-onco-1", title: "Gynecology Fellowship Berlin", provider: "Charité", countryCode: "DE", status: "ACTIVE", recordType: "SCHOLARSHIP", studyLevels: '["MASTERS"]', fields: '["medicine"]', eligibleNationalities: '["ALL"]', fundingType: "FULLY_FUNDED", languageRequirements: "{}", requiredDocuments: "[]", applicationSteps: "[]", benefits: "[]" },
      { slug: "smoke-onco-2", title: "Oncology Research Grant", provider: "DKFZ", countryCode: "DE", status: "ACTIVE", recordType: "SCHOLARSHIP", studyLevels: '["PHD"]', fields: '["medicine"]', eligibleNationalities: '["PK"]', fundingType: "PARTIAL", languageRequirements: "{}", requiredDocuments: "[]", applicationSteps: "[]", benefits: "[]" },
    ],
  });
  // case-insensitive keyword search (was mode:"insensitive")
  const r1 = await prisma.scholarship.findMany({ where: { status: "ACTIVE", recordType: "SCHOLARSHIP", OR: [{ title: { contains: "gynecology" } }, { description: { contains: "gynecology" } }, { provider: { contains: "gynecology" } }] } });
  console.log("lowercase 'gynecology' hits:", r1.length, "->", r1.map((s) => s.title).join(", "));
  // uppercase query
  const r2 = await prisma.scholarship.findMany({ where: { status: "ACTIVE", recordType: "SCHOLARSHIP", OR: [{ title: { contains: "ONCOLOGY" } }, { description: { contains: "ONCOLOGY" } }, { provider: { contains: "ONCOLOGY" } }] } });
  console.log("uppercase 'ONCOLOGY' hits:", r2.length, "->", r2.map((s) => s.title).join(", "));
  // JSON-contains filter on fields
  const r3 = await prisma.scholarship.findMany({ where: { fields: { contains: '"medicine"' } } });
  console.log("fields=medicine hits:", r3.length);
  // nationality OR branch
  const r4 = await prisma.scholarship.findMany({ where: { AND: [{ OR: [{ eligibleNationalities: { contains: "PK" } }, { eligibleNationalities: { contains: '"ALL"' } }] }] } });
  console.log("nationality PK|ALL hits:", r4.length);
  // cleanup
  await prisma.scholarship.deleteMany({ where: { slug: { startsWith: "smoke-" } } });
  await prisma.country.delete({ where: { code: "DE" } });
  console.log("OK");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
