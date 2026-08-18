import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("global")!;

export const metadata: Metadata = {
  title: "Global & Multi-Country Scholarships",
  description:
    "Multi-country programmes like Erasmus Mundus, international fellowships and online scholarships open to students worldwide — with no single host country.",
  alternates: { canonical: "/scholarships/global" },
};

export default function Page() {
  return <CategoryPage category={category} />;
}
