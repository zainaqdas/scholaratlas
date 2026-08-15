import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const data = await searchSuggestions(q);
  return NextResponse.json(data);
}
