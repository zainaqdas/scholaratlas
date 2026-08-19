import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Aggregate pages whose cached lists/counts should refresh after a status flip.
// Detail pages are intentionally NOT revalidated: their deadline badges are
// client-side and live, so a cached detail page already shows "Closed" the
// moment the deadline passes — re-rendering 10k pages on a cron would waste
// reads for nothing.
const AGGREGATE_PATHS = [
  "/",
  "/countries",
  "/fields",
  "/universities",
  "/deadlines",
  "/scholarships/fully-funded",
  "/scholarships/undergraduate",
  "/scholarships/masters",
  "/scholarships/phd",
  "/scholarships/no-ielts",
  "/scholarships/international-students",
  "/scholarships/global",
];

// Daily database hygiene, invoked by Vercel Cron (free plan supports
// once-per-day). Search already excludes passed deadlines at query time; this
// keeps the STORED status in sync so the admin dashboard, sitemap and any
// status-EXPLICIT queries agree with reality.
export async function GET(req: NextRequest) {
  // Only Vercel's cron runner may invoke this. Cron requests always carry the
  // schedule header and a "vercel-cron" user agent.
  const schedule = req.headers.get("x-vercel-cron-schedule");
  const ua = req.headers.get("user-agent") ?? "";
  if (!schedule || !ua.includes("vercel-cron")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const now = new Date();
  const flipped = await prisma.scholarship.updateMany({
    where: { status: "ACTIVE", deadline: { lt: now } },
    data: { status: "EXPIRED", updatedAt: now },
  });

  // Mark the aggregate pages for re-render on their next request so counts and
  // lists reflect the flip immediately instead of waiting out their TTLs.
  for (const path of AGGREGATE_PATHS) {
    try {
      revalidatePath(path);
    } catch {
      // A path not yet generated (e.g. before first visit) is fine to skip.
    }
  }

  return NextResponse.json({
    ok: true,
    flipped: flipped.count,
    revalidated: AGGREGATE_PATHS.length,
    schedule,
  });
}
