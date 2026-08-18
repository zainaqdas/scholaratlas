// SEO category landing pages under /scholarships/[category].
import type { SearchFilters } from "./search";
import { FIELD_GROUPS, fieldGroupBySlug, fieldName } from "./constants";

export interface CategoryPageDef {
  slug: string;
  title: string;
  headline: string;
  intro: string;
  filters: SearchFilters;
  faqs: { q: string; a: string }[];
  related: { label: string; href: string }[];
}

export const CATEGORY_PAGES: CategoryPageDef[] = [
  {
    slug: "fully-funded",
    title: "Fully Funded Scholarships",
    headline: "Fully Funded Scholarships",
    intro:
      "Fully funded scholarships cover your tuition and often living expenses, travel and insurance — so you can focus entirely on your studies. Explore government programmes, university awards and foundation scholarships from around the world.",
    filters: { funding: ["FULLY_FUNDED", "FULLY_FUNDED_STIPEND"] },
    faqs: [
      { q: "What does fully funded mean?", a: "A fully funded scholarship typically covers tuition fees plus a living allowance, and may also cover travel, accommodation and health insurance. Always check the exact coverage on the official provider page." },
      { q: "Do fully funded scholarships exist for every study level?", a: "Yes — fully funded options exist for undergraduate, master's, PhD and research programmes. Government programmes (like DAAD, Chevening, Fulbright) are common sources." },
      { q: "Is it harder to get a fully funded scholarship?", a: "They are competitive, but many go unfilled because students don't apply. A strong application and early deadline tracking make a real difference." },
    ],
    related: [
      { label: "Master's Scholarships", href: "/scholarships/masters" },
      { label: "PhD & Research", href: "/scholarships/phd" },
      { label: "Scholarships in Germany", href: "/scholarships?country=DE" },
      { label: "Scholarships in UK", href: "/scholarships?country=GB" },
    ],
  },
  {
    slug: "undergraduate",
    title: "Undergraduate Scholarships",
    headline: "Undergraduate Scholarships",
    intro:
      "Funding for bachelor's students: merit scholarships, need-based aid, government awards and university entrance scholarships for international students.",
    filters: { levels: ["undergraduate"] },
    faqs: [
      { q: "Can international students get undergraduate scholarships?", a: "Yes. Many universities offer automatic consideration for international entrance scholarships, and several governments fund bachelor's study abroad." },
      { q: "When should I apply for undergraduate scholarships?", a: "Typically 6–12 months before the academic year starts. Deadlines vary by country and university." },
    ],
    related: [
      { label: "Fully Funded", href: "/scholarships/fully-funded" },
      { label: "Scholarships in USA", href: "/scholarships?country=US" },
      { label: "Scholarships in Canada", href: "/scholarships?country=CA" },
    ],
  },
  {
    slug: "masters",
    title: "Master's Scholarships",
    headline: "Master's Scholarships",
    intro:
      "Graduate study can be expensive — but master's scholarships from governments, universities and foundations can cover tuition, stipends and more. Find the right one for your field and destination.",
    filters: { levels: ["masters"] },
    faqs: [
      { q: "Are master's scholarships available to international students?", a: "Yes — most master's scholarships are designed for international students, from programmes like Erasmus Mundus, Chevening and DAAD." },
      { q: "Do I need IELTS for a master's scholarship?", a: "Not always. Some programmes accept alternative English proof or waive the requirement if your previous degree was in English." },
    ],
    related: [
      { label: "Fully Funded", href: "/scholarships/fully-funded" },
      { label: "No IELTS Scholarships", href: "/scholarships/no-ielts" },
      { label: "Scholarships in Europe", href: "/scholarships?country=DE,FR,NL,IT,ES,SE,CH" },
    ],
  },
  {
    slug: "phd",
    title: "PhD & Research Scholarships",
    headline: "PhD & Research Scholarships",
    intro:
      "Fully funded doctoral and research positions. Many European PhDs are salaried positions — discover funded projects across universities and research institutes worldwide.",
    filters: { levels: ["phd", "research", "postdoctoral"] },
    faqs: [
      { q: "How are PhD students funded in Europe?", a: "Many European PhDs are salaried employment positions rather than scholarships — you apply to a funded project and receive a monthly salary." },
      { q: "What do I need for a PhD application?", a: "A strong research proposal, academic transcripts, CV and reference letters are the core documents. Some positions require IELTS/TOEFL." },
    ],
    related: [
      { label: "Fully Funded", href: "/scholarships/fully-funded" },
      { label: "Research Fields", href: "/fields" },
      { label: "Scholarships in Germany", href: "/scholarships?country=DE" },
    ],
  },
  {
    slug: "no-ielts",
    title: "Scholarships Without IELTS",
    headline: "Scholarships Without IELTS",
    intro:
      "Not everyone needs IELTS. Many scholarships and universities accept TOEFL, alternative English proof, or no English test at all. Browse opportunities with flexible language requirements.",
    filters: { languages: ["no-ielts", "not-required"] },
    faqs: [
      { q: "Which scholarships don't require IELTS?", a: "Many government scholarships (e.g. Chinese Government Scholarship) and programmes where instruction is in another language, or where alternative proof is accepted." },
      { q: "What counts as alternative English proof?", a: "Previous education in English, a letter from your university, or other recognized tests — check each programme's specific policy." },
    ],
    related: [
      { label: "Master's Scholarships", href: "/scholarships/masters" },
      { label: "Fully Funded", href: "/scholarships/fully-funded" },
      { label: "Scholarships in China", href: "/scholarships?country=CN" },
    ],
  },
  {
    slug: "international-students",
    title: "Scholarships for International Students",
    headline: "Scholarships for International Students",
    intro:
      "Study abroad with financial support. Government scholarships, university international awards and global programmes that welcome students from all nationalities.",
    filters: { nationality: "international" },
    faqs: [
      { q: "Am I eligible as an international student?", a: "Most scholarships on this page are open to all nationalities. Always check the eligible nationalities list on each scholarship." },
      { q: "Can I get a fully funded scholarship to study abroad?", a: "Yes — programmes like DAAD, Chevening, Fulbright, MEXT and CSC fully fund international students." },
    ],
    related: [
      { label: "Fully Funded", href: "/scholarships/fully-funded" },
      { label: "Scholarships by Country", href: "/countries" },
      { label: "No IELTS Scholarships", href: "/scholarships/no-ielts" },
    ],
  },
  {
    slug: "global",
    title: "Global & Multi-Country Scholarships",
    headline: "Global & Multi-Country Scholarships",
    intro:
      "Programmes that don't belong to a single country — joint and multi-country programmes like Erasmus Mundus, international fellowships (Rotary, IDB, Fulbright), regional awards and online/distance opportunities open to students worldwide. When a scholarship spans many destinations, we list it here rather than pinning it to one country.",
    filters: { countries: ["GLOBAL"] },
    faqs: [
      { q: "What makes a scholarship 'global'?", a: "A scholarship is listed here when it has no single host country: multi-country programmes (e.g. Erasmus Mundus joint degrees), international fellowships with rotating or multiple locations, regional awards covering several countries, and online/distance programmes with no physical campus." },
      { q: "Can I apply to these from any country?", a: "Not necessarily — many global programmes still restrict applicants by nationality or residence. Always check the eligible nationalities and requirements on the official provider page." },
      { q: "Why aren't these on country pages?", a: "Because they span multiple destinations, no single country page would represent them accurately. Listing them here keeps country pages honest while still making these opportunities easy to find." },
    ],
    related: [
      { label: "Scholarships for International Students", href: "/scholarships/international-students" },
      { label: "Fully Funded", href: "/scholarships/fully-funded" },
      { label: "Master's Scholarships", href: "/scholarships/masters" },
      { label: "Explore by Country", href: "/countries" },
    ],
  },
];

export const categoryBySlug = (slug: string) => CATEGORY_PAGES.find((c) => c.slug === slug);

// Dynamic SEO landing pages for the broad field categories (umbrella groups),
// e.g. /scholarships/medicine-health. These are data-driven: the filters map to
// the group's field filter (which already expands to every child sub-field).
export function fieldGroupCategory(slug: string): CategoryPageDef | null {
  const group = fieldGroupBySlug(slug);
  if (!group) return null;

  const others = FIELD_GROUPS.filter((g) => g.slug !== slug);
  const subNames = group.children.map(fieldName);
  const subSummary =
    subNames.length > 4
      ? `${subNames.slice(0, 4).join(", ")} and more`
      : subNames.join(", ");

  return {
    slug: group.slug,
    title: `${group.name} Scholarships`,
    headline: `${group.name} Scholarships`,
    intro: `${group.description} Browse ${group.name.toLowerCase()} opportunities from universities, governments and foundations around the world, then narrow by sub-field, study level, funding and destination.`,
    filters: { field: group.slug },
    faqs: [
      {
        q: `Which fields are included in ${group.name}?`,
        a: `${group.name} is an umbrella category covering ${subSummary}. Scholarships tagged with any of these sub-fields — plus open-to-all opportunities — appear on this page.`,
      },
      {
        q: `Can I see only one sub-field of ${group.name}?`,
        a: "Yes — open the specific sub-field page from Related Categories below, or use the Field of Study filter on the search page and pick the exact sub-field.",
      },
      {
        q: "Are these scholarships for a specific study level?",
        a: "No — the category includes undergraduate, master's, PhD and other levels. Use the study level filter on the search page to narrow down.",
      },
      {
        q: "How do I know if I'm eligible?",
        a: "Eligibility varies by scholarship. Always check the eligible nationalities and requirements on the official provider website before applying.",
      },
    ],
    related: [
      { label: `All ${group.name} sub-fields`, href: `/fields/${group.slug}` },
      ...others.map((g) => ({ label: `${g.name} Scholarships`, href: `/scholarships/${g.slug}` })),
      { label: "All Fields of Study", href: "/fields" },
    ],
  };
}
