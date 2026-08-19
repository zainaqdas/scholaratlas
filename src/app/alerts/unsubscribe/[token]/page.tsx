import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false } };

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function UnsubscribePage({ params }: PageProps) {
  const { token } = await params;

  const user = await prisma.user.findFirst({
    where: { unsubscribeToken: token },
    select: { id: true, email: true },
  });

  let unsubscribed = false;
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { alertUnsubscribed: true },
    });
    await prisma.alert.deleteMany({ where: { userId: user.id } });
    unsubscribed = true;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <BellOff className="h-7 w-7 text-muted-foreground" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight">
        {unsubscribed ? "You're unsubscribed" : "Invalid link"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {unsubscribed
          ? "Deadline reminder emails are now off for this account. You can re-enable them anytime by saving a scholarship and turning reminders back on."
          : "This unsubscribe link isn't valid. It may have already been used or the link was copied incorrectly."}
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to ScholarAtlas</Link>
      </Button>
    </div>
  );
}
