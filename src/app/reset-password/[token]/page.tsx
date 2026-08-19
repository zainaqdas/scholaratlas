import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Reset Password", robots: { index: false } };

interface PageProps {
  params: Promise<{ token: string }>;
}

async function hashToken(raw: string): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: await hashToken(token) },
  });
  const valid = Boolean(record && record.expiresAt >= new Date());

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
        <KeyRound className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
        {valid ? "Choose a new password" : "Invalid or expired link"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {valid
          ? "Pick a strong password — at least 8 characters."
          : "This reset link is invalid or has expired. Request a new one and try again."}
      </p>
      <div className="mt-8">
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
