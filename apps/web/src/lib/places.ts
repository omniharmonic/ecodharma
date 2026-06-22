import "server-only";

// Universal place → coordinates → IANA timezone resolution.
//
// A hardcoded gazetteer of a handful of cities is unacceptable: ANY birthplace a
// person types must resolve. So the resolver is, in order:
//   1. an exact match in the curated CITIES list (instant, offline — also the
//      datalist suggestions and what keeps e2e deterministic),
//   2. Mapbox forward geocoding when GEOCODING_API_KEY is set,
//   3. Open-Meteo geocoding — FREE, no key, and crucially returns the real IANA
//      timezone — the universal resolver for every other city on Earth,
//   4. a substring match against the offline gazetteer (network-down fallback).
// If none resolve we return null so the caller asks for explicit coordinates —
// we never silently fabricate a location for a real chart.

export type Place = { lat: number; lng: number; tz: string; label?: string };

// Curated suggestions for the onboarding datalist (NOT the resolver — any city works).
export const CITIES: Record<string, Place> = {
  "New York, USA": { lat: 40.7128, lng: -74.006, tz: "America/New_York" },
  "Los Angeles, USA": { lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles" },
  "San Francisco, USA": { lat: 37.7749, lng: -122.4194, tz: "America/Los_Angeles" },
  "Portland, USA": { lat: 45.5152, lng: -122.6784, tz: "America/Los_Angeles" },
  "Austin, USA": { lat: 30.2672, lng: -97.7431, tz: "America/Chicago" },
  "Boulder, USA": { lat: 40.015, lng: -105.2705, tz: "America/Denver" },
  "Mexico City, Mexico": { lat: 19.4326, lng: -99.1332, tz: "America/Mexico_City" },
  "London, UK": { lat: 51.5074, lng: -0.1278, tz: "Europe/London" },
  "Berlin, Germany": { lat: 52.52, lng: 13.405, tz: "Europe/Berlin" },
  "Lisbon, Portugal": { lat: 38.7223, lng: -9.1393, tz: "Europe/Lisbon" },
  "Paris, France": { lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" },
  "Barcelona, Spain": { lat: 41.3851, lng: 2.1734, tz: "Europe/Madrid" },
  "Amsterdam, Netherlands": { lat: 52.3676, lng: 4.9041, tz: "Europe/Amsterdam" },
  "Cape Town, South Africa": { lat: -33.9249, lng: 18.4241, tz: "Africa/Johannesburg" },
  "Nairobi, Kenya": { lat: -1.2921, lng: 36.8219, tz: "Africa/Nairobi" },
  "Mumbai, India": { lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata" },
  "Bali, Indonesia": { lat: -8.3405, lng: 115.092, tz: "Asia/Makassar" },
  "Bangkok, Thailand": { lat: 13.7563, lng: 100.5018, tz: "Asia/Bangkok" },
  "Tokyo, Japan": { lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" },
  "Sydney, Australia": { lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" },
  "Auckland, New Zealand": { lat: -36.8485, lng: 174.7633, tz: "Pacific/Auckland" },
  "Toronto, Canada": { lat: 43.6532, lng: -79.3832, tz: "America/Toronto" },
  "Vancouver, Canada": { lat: 49.2827, lng: -123.1207, tz: "America/Vancouver" },
  "São Paulo, Brazil": { lat: -23.5558, lng: -46.6396, tz: "America/Sao_Paulo" },
  "Buenos Aires, Argentina": { lat: -34.6037, lng: -58.3816, tz: "America/Argentina/Buenos_Aires" },
};

// Lowercased substring gazetteer for the offline (network-down) fallback only.
const GAZETTEER: Record<string, Place> = Object.fromEntries(
  Object.entries(CITIES).map(([name, p]) => [name.split(",")[0].toLowerCase(), p]),
);

// Crude offline fallback: map longitude to a valid Etc/GMT zone (signs inverted).
function tzFromLng(lng: number): string {
  const offset = Math.max(-12, Math.min(12, Math.round(lng / 15)));
  const sign = offset <= 0 ? "+" : "-";
  return `Etc/GMT${sign}${Math.abs(offset)}`;
}

// Back-compat: synchronous exact-match against the curated list (datalist picks).
export function resolvePlace(name: string | null): Place | null {
  if (!name) return null;
  return CITIES[name] ?? null;
}

// The universal resolver. Returns null if a place genuinely can't be resolved
// (offline + unlisted) so the caller can ask for explicit coordinates.
export async function geocode(place: string | null): Promise<Place | null> {
  if (!place || !place.trim()) return null;
  const query = place.trim();

  // 1. exact curated match — instant, offline, deterministic.
  if (CITIES[query]) return { ...CITIES[query], label: query };

  // 2. Mapbox forward geocoding when a key is configured.
  const key = process.env.GEOCODING_API_KEY;
  if (key) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&types=place,locality,region&access_token=${key}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as { features?: Array<{ center: [number, number]; place_name: string }> };
        const f = j.features?.[0];
        if (f) {
          const [lng, lat] = f.center;
          return { lat, lng, tz: tzFromLng(lng), label: f.place_name };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 3. Open-Meteo — free, keyless, returns the real IANA timezone. The universal path.
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as {
        results?: Array<{ name: string; latitude: number; longitude: number; timezone?: string; admin1?: string; country_code?: string }>;
      };
      const f = j.results?.[0];
      if (f && Number.isFinite(f.latitude) && Number.isFinite(f.longitude)) {
        const label = [f.name, f.admin1, f.country_code].filter(Boolean).join(", ");
        return { lat: f.latitude, lng: f.longitude, tz: f.timezone || tzFromLng(f.longitude), label };
      }
    }
  } catch {
    /* network down — fall through to the offline gazetteer */
  }

  // 4. offline substring fallback against the curated gazetteer.
  const q = query.toLowerCase();
  for (const [name, g] of Object.entries(GAZETTEER)) {
    if (q.includes(name)) return { ...g, label: query };
  }

  // genuinely unresolvable (offline + unlisted): let the caller ask for coordinates.
  return null;
}
