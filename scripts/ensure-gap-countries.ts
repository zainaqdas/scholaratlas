/**
 * ensure-gap-countries.ts — add missing Country rows for gap-fill countries.
 * Flags use the regional indicator emoji derived from the ISO code.
 */
import { prisma } from "../src/lib/prisma";

const NEEDED: Record<string, { name: string; region: string }> = {
  IL: { name: "Israel", region: "Asia" },
  HU: { name: "Hungary", region: "Europe" },
  GR: { name: "Greece", region: "Europe" },
  RO: { name: "Romania", region: "Europe" },
  CZ: { name: "Czech Republic", region: "Europe" },
  PL: { name: "Poland", region: "Europe" },
  PT: { name: "Portugal", region: "Europe" },
  BG: { name: "Bulgaria", region: "Europe" },
  HR: { name: "Croatia", region: "Europe" },
  RS: { name: "Serbia", region: "Europe" },
  SI: { name: "Slovenia", region: "Europe" },
  SK: { name: "Slovakia", region: "Europe" },
  EE: { name: "Estonia", region: "Europe" },
  LV: { name: "Latvia", region: "Europe" },
  LT: { name: "Lithuania", region: "Europe" },
  IS: { name: "Iceland", region: "Europe" },
  LU: { name: "Luxembourg", region: "Europe" },
  CY: { name: "Cyprus", region: "Europe" },
  UA: { name: "Ukraine", region: "Europe" },
  BY: { name: "Belarus", region: "Europe" },
  BA: { name: "Bosnia and Herzegovina", region: "Europe" },
  MK: { name: "North Macedonia", region: "Europe" },
  ME: { name: "Montenegro", region: "Europe" },
  AL: { name: "Albania", region: "Europe" },
  MD: { name: "Moldova", region: "Europe" },
  GE: { name: "Georgia", region: "Asia" },
  AM: { name: "Armenia", region: "Asia" },
  AZ: { name: "Azerbaijan", region: "Asia" },
  KZ: { name: "Kazakhstan", region: "Asia" },
  UZ: { name: "Uzbekistan", region: "Asia" },
  KG: { name: "Kyrgyzstan", region: "Asia" },
  TJ: { name: "Tajikistan", region: "Asia" },
  TM: { name: "Turkmenistan", region: "Asia" },
  MN: { name: "Mongolia", region: "Asia" },
  NP: { name: "Nepal", region: "Asia" },
  BD: { name: "Bangladesh", region: "Asia" },
  LK: { name: "Sri Lanka", region: "Asia" },
  MM: { name: "Myanmar", region: "Asia" },
  KH: { name: "Cambodia", region: "Asia" },
  LA: { name: "Laos", region: "Asia" },
  AF: { name: "Afghanistan", region: "Asia" },
  IR: { name: "Iran", region: "Asia" },
  IQ: { name: "Iraq", region: "Asia" },
  JO: { name: "Jordan", region: "Asia" },
  LB: { name: "Lebanon", region: "Asia" },
  KW: { name: "Kuwait", region: "Asia" },
  OM: { name: "Oman", region: "Asia" },
  QA: { name: "Qatar", region: "Asia" },
  SA: { name: "Saudi Arabia", region: "Asia" },
  BH: { name: "Bahrain", region: "Asia" },
  YE: { name: "Yemen", region: "Asia" },
  SY: { name: "Syria", region: "Asia" },
  PS: { name: "Palestine", region: "Asia" },
  AR: { name: "Argentina", region: "Americas" },
  CL: { name: "Chile", region: "Americas" },
  CO: { name: "Colombia", region: "Americas" },
  PE: { name: "Peru", region: "Americas" },
  MX: { name: "Mexico", region: "Americas" },
  BR: { name: "Brazil", region: "Americas" },
  CR: { name: "Costa Rica", region: "Americas" },
  PA: { name: "Panama", region: "Americas" },
  EC: { name: "Ecuador", region: "Americas" },
  BO: { name: "Bolivia", region: "Americas" },
  PY: { name: "Paraguay", region: "Americas" },
  UY: { name: "Uruguay", region: "Americas" },
  VE: { name: "Venezuela", region: "Americas" },
  CU: { name: "Cuba", region: "Americas" },
  DO: { name: "Dominican Republic", region: "Americas" },
  GT: { name: "Guatemala", region: "Americas" },
  HN: { name: "Honduras", region: "Americas" },
  NI: { name: "Nicaragua", region: "Americas" },
  SV: { name: "El Salvador", region: "Americas" },
  JM: { name: "Jamaica", region: "Americas" },
  TT: { name: "Trinidad and Tobago", region: "Americas" },
};

function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

async function main() {
  const existing = new Set((await prisma.country.findMany({ select: { code: true } })).map((c) => c.code));
  let created = 0;
  for (const [code, meta] of Object.entries(NEEDED)) {
    if (existing.has(code)) continue;
    await prisma.country.create({
      data: { code, name: meta.name, flag: flagEmoji(code), region: meta.region },
    });
    created++;
    console.log(`Created country: ${code} ${meta.name}`);
  }
  console.log(`Done: created=${created}`);
}

main()
  .catch((e) => { console.error("ensure-gap-countries:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
