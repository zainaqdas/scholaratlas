import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("international-students")!;

export const metadata: Metadata = {
  title: "Scholarships for International Students",
  description:
    "Study abroad with financial support — government scholarships, university international awards and programmes open to all nationalities.",
  alternates: { canonical: "/scholarships/international-students" },
};

export const revalidate = 604800;

export default function Page() {
  return <CategoryPage category={category} />;
}
