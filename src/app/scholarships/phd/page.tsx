import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("phd")!;

export const metadata: Metadata = {
  title: "PhD & Research Scholarships",
  description:
    "Fully funded doctoral and research positions, fellowships and salaried PhD opportunities at universities worldwide.",
  alternates: { canonical: "/scholarships/phd" },
};

export default function Page() {
  return <CategoryPage category={category} />;
}
