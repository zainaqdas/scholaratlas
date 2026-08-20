"use client";

import {
  Atom,
  Banknote,
  BarChart3,
  Battery,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  Briefcase,
  Building,
  Building2,
  Bus,
  Calculator,
  Car,
  CircuitBoard,
  Code,
  Cog,
  Cpu,
  Dna,
  Droplet,
  Droplets,
  Dumbbell,
  Factory,
  FileCheck,
  FlaskConical,
  Gem,
  Globe2,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Languages,
  Layers,
  Leaf,
  MapPin,
  Megaphone,
  Microscope,
  Monitor,
  Mountain,
  Music,
  Palette,
  PenTool,
  Plane,
  Plug,
  Quote,
  Rocket,
  Ruler,
  Scale,
  Scroll,
  ShieldCheck,
  ShieldPlus,
  Sigma,
  SlidersHorizontal,
  Smile,
  Sprout,
  Stethoscope,
  Syringe,
  Telescope,
  Tractor,
  TrendingUp,
  Trophy,
  Users,
  Video,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Replaces the emoji tiles in QUICK_CATEGORIES / FIELD_GROUPS with Lucide
 * icons. Keyed by the same slugs, so every render site (homepage, fields
 * pages, filter sidebar) can swap in one component.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Quick categories
  "fully-funded": Gem,
  "no-ielts": Languages,
  undergraduate: GraduationCap,
  masters: BookOpen,
  phd: Microscope,
  "international-students": Globe2,
  contests: Trophy,
  jobs: Briefcase,
  // Field groups
  "medicine-health": Stethoscope,
  "computer-science-it": Cpu,
  "business-economics": Landmark,
  engineering: Cog,
  "natural-sciences": Telescope,
  "social-sciences": Users,
  "arts-design-media": Palette,
  "agriculture-environment": Leaf,
};

/**
 * Per-field-of-study icons (96 leaf fields + the 8 broad groups). Every slug
 * in constants.FIELDS / FIELD_GROUPS has an entry; unknown slugs fall back to
 * BookOpen.
 */
export const FIELD_ICONS: Record<string, LucideIcon> = {
  ...CATEGORY_ICONS,
  // Engineering
  "computer-science": Monitor,
  "artificial-intelligence": Brain,
  "data-science": BarChart3,
  cybersecurity: ShieldCheck,
  "mechanical-engineering": Cog,
  "civil-engineering": Building2,
  "electrical-engineering": Zap,
  "electronic-engineering": CircuitBoard,
  "chemical-engineering": FlaskConical,
  "software-engineering": Code,
  "computer-engineering": Cpu,
  "aerospace-engineering": Rocket,
  "biomedical-engineering": HeartPulse,
  "environmental-engineering": Leaf,
  "materials-engineering": Layers,
  "industrial-engineering": Factory,
  "power-engineering": Plug,
  "energy-engineering": Battery,
  "control-engineering": SlidersHorizontal,
  "petroleum-engineering": Droplet,
  "transportation-engineering": Bus,
  "manufacturing-engineering": Factory,
  "systems-engineering": Boxes,
  "mining-engineering": Mountain,
  "structural-engineering": Building,
  "automotive-engineering": Car,
  "geotechnical-engineering": Mountain,
  "agricultural-engineering": Tractor,
  "nuclear-engineering": Atom,
  "robotics-engineering": Bot,
  "telecommunication-engineering": Wifi,
  "water-resources-engineering": Droplets,
  // Medicine & health
  medicine: Stethoscope,
  "public-health": HeartPulse,
  nursing: Syringe,
  biotechnology: Dna,
  biology: Microscope,
  dentistry: Smile,
  chemistry: FlaskConical,
  // Natural sciences & math
  physics: Atom,
  mathematics: Sigma,
  statistics: BarChart3,
  "natural-sciences": Telescope,
  "environmental-science": Leaf,
  energy: Battery,
  // Business & economics
  business: Briefcase,
  finance: Banknote,
  economics: TrendingUp,
  marketing: Megaphone,
  accounting: Calculator,
  // Social sciences & law
  law: Scale,
  "political-science": Landmark,
  "international-relations": Globe2,
  "social-sciences": Users,
  psychology: Brain,
  education: GraduationCap,
  // Humanities
  history: Scroll,
  philosophy: Quote,
  linguistics: Languages,
  classics: Landmark,
  humanities: BookOpen,
  // Applied & creative
  agriculture: Sprout,
  architecture: Ruler,
  arts: Palette,
  design: PenTool,
  media: Video,
  music: Music,
  tourism: MapPin,
  "sports-science": Dumbbell,
};

/** Benefit chips on scholarship detail pages — keyed by BenefitKey. */
export const BENEFIT_ICONS: Record<string, LucideIcon> = {
  tuition: GraduationCap,
  stipend: Wallet,
  accommodation: Home,
  insurance: ShieldPlus,
  airfare: Plane,
  visaSupport: FileCheck,
  researchAllowance: FlaskConical,
};

export function CategoryIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[slug] ?? Gem;
  return <Icon className={className} aria-hidden />;
}

export function FieldIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string;
  className?: string;
}) {
  const Icon = FIELD_ICONS[slug] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}

export function BenefitIcon({
  benefit,
  className = "h-5 w-5",
}: {
  benefit: string;
  className?: string;
}) {
  const Icon = BENEFIT_ICONS[benefit] ?? Gem;
  return <Icon className={className} aria-hidden />;
}
