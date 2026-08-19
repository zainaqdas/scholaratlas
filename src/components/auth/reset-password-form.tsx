"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction, type ActionResult } from "@/app/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(resetPasswordAction, { ok: false });

  if (state.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/50">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-3 font-semibold">Password updated</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your password has been changed and all other sessions were signed out. You can sign in now.
        </p>
        <Button asChild className="mt-4">
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
      </div>
      <Button type="submit" className="w-full gap-2" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Set new password
      </Button>
    </form>
  );
}
