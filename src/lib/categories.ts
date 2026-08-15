// SEO category landing pages under /scholarships/[category].
import type { SearchFilters } from "./search";

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
];

export const categoryBySlug = (slug: string) => CATEGORY_PAGES.find((c) => c.slug === slug);
