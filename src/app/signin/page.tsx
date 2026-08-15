import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/signin-form";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Sign In", robots: { index: false } };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex justify-center">
        <LogoMark className="h-14 w-14" />
      </div>
      <h1 className="text-center font-display text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">
        Sign in to save scholarships, track deadlines and get personalized recommendations.
      </p>
      <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
        <SignInForm next={next} />
      </div>
    </div>
  );
}
