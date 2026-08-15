import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/signup-form";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Create Account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex justify-center">
        <LogoMark className="h-14 w-14" />
      </div>
      <h1 className="text-center font-display text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">
        Free forever. Save scholarships, get deadline alerts and receive personalized recommendations.
      </p>
      <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
