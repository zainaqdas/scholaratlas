import { NextResponse } from "next/server";
import { parseAiQuery, criteriaToFilters, criteriaSummary } from "@/lib/ai-search";
import { searchScholarships } from "@/lib/search";
import { matchScholarship } from "@/lib/scholarship";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body?.query ?? "").trim();
    if (!query) {
      return NextResponse.json({ error: "Please describe what you're looking for." }, { status: 400 });
    }

    const criteria = parseAiQuery(query);
    const filters = criteriaToFilters(criteria);
    const result = await searchScholarships({ ...filters, sort: "relevance", page: 1 });
    const limit = Math.min(12, result.items.length);

    const items = result.items.slice(0, limit).map((s) => {
      const match = matchScholarship(s, {
        nationality: criteria.nationality,
        degreeLevel: criteria.levels?.[0],
        fieldOfStudy: criteria.field,
        preferredDestination: criteria.countries?.[0],
      });
      return { scholarship: s, match };
    });

    items.sort((a, b) => b.match.score - a.match.score);

    return NextResponse.json({
      summary: criteriaSummary(criteria),
      count: result.total,
      items,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
