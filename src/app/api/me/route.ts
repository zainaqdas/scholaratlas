import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Minimal user payload for client-side components (SiteHeader). Kept separate
// from the full User record so nothing sensitive ever reaches the client.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
