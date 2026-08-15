import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("no-ielts")!;

export const metadata: Metadata = {
  title: "Scholarships Without IELTS",
  description:
    "Scholarships that don't require IELTS — programmes accepting TOEFL, alternative English proof or no English test at all.",
  alternates: { canonical: "/scholarships/no-ielts" },
};

export default function Page() {
  return <CategoryPage category={category} />;
}
