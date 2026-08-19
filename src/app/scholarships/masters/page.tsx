import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";
import { categoryBySlug } from "@/lib/categories";

const category = categoryBySlug("masters")!;

export const metadata: Metadata = {
  title: "Master's Scholarships",
  description:
    "Master's scholarships and fellowships covering tuition and living costs for graduate study around the world.",
  alternates: { canonical: "/scholarships/masters" },
};

export const revalidate = 604800;

export default function Page() {
  return <CategoryPage category={category} />;
}
