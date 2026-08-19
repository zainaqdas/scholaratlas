import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json([]);

  const items = await prisma.scholarship.findMany({
    // Public API: never return unapproved submissions (PENDING/REJECTED).
    where: { id: { in: ids }, recordType: "SCHOLARSHIP", status: { in: ["ACTIVE", "EXPIRED"] } },
    include: { university: true, country: true },
  });
  // preserve requested order
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json(ordered);
}
