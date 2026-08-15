import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("fully-funded")!;

export const metadata: Metadata = {
  title: "Fully Funded Scholarships",
  description:
    "Fully funded scholarships covering tuition, living costs and more — from governments, universities and foundations worldwide.",
  alternates: { canonical: "/scholarships/fully-funded" },
};

export default function Page() {
  return <CategoryPage category={category} />;
}
