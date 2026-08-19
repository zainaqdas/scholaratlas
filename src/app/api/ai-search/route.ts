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

    // Graceful broadening: many catalogue records have an unspecified field list
    // ("fields": []), so a strict field filter can return 0 even when strong
    // opportunities exist (e.g. a fully-funded PhD in Japan with no field tag).
    // If strict criteria find nothing, retry without the field, then also
    // without the nationality — the loosest search still honours level, funding,
    // destination and keywords. The summary reflects what actually ran.
    let effective = criteria;
    let result = await searchScholarships({ ...criteriaToFilters(criteria), sort: "relevance", page: 1 });
    if (result.total === 0 && criteria.field) {
      effective = { ...criteria, field: undefined };
      result = await searchScholarships({ ...criteriaToFilters(effective), sort: "relevance", page: 1 });
    }
    if (result.total === 0 && effective.nationality) {
      effective = { ...effective, nationality: undefined };
      result = await searchScholarships({ ...criteriaToFilters(effective), sort: "relevance", page: 1 });
    }

    const limit = Math.min(12, result.items.length);

    const items = result.items.slice(0, limit).map((s) => {
      const match = matchScholarship(s, {
        nationality: effective.nationality,
        degreeLevel: effective.levels?.[0],
        fieldOfStudy: effective.field,
        preferredDestination: effective.countries?.[0],
      });
      return { scholarship: s, match };
    });

    items.sort((a, b) => b.match.score - a.match.score);

    return NextResponse.json({
      summary: criteriaSummary(effective),
      count: result.total,
      items,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
