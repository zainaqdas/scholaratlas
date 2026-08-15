import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { signoutAction } from "@/app/actions";

export const metadata: Metadata = { title: "Sign Out", robots: { index: false } };

export default function SignOutPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Sign out of ScholarAtlas?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You can always sign back in — your saved scholarships stay on your account.
      </p>
      <form action={signoutAction} className="mt-6 flex gap-3">
        <Button type="submit">Sign Out</Button>
        <Button asChild variant="outline">
          <a href="/dashboard">Cancel</a>
        </Button>
      </form>
    </div>
  );
}
