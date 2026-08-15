import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("undergraduate")!;

export const metadata: Metadata = {
  title: "Undergraduate Scholarships",
  description:
    "Scholarships for bachelor's students: merit awards, government funding and university entrance scholarships for international students.",
  alternates: { canonical: "/scholarships/undergraduate" },
};

export default function Page() {
  return <CategoryPage category={category} />;
}
