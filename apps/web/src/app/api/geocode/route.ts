import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/places";

// Place-search for the onboarding autocomplete: ?q=Salem → up to 6 precise
// matches (label + lat/lng/tz) so a person picks the EXACT city rather than
// letting an ambiguous name silently resolve to the wrong one.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.trim().length < 2) return NextResponse.json({ places: [] });
  try {
    const places = await searchPlaces(q);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
