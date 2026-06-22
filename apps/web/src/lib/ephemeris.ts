import "server-only";

export type BirthInput = {
  name?: string;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  lat: number;
  lng: number;
  tz_str: string;
  unknown_time: boolean;
};

export type ChartResponse = {
  modality: string;
  engine_version: string;
  time_dependent_fields: string[];
  data: Record<string, unknown>;
};

const BASE = () => process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";
const TOKEN = () => process.env.EPHEMERIS_TOKEN;

// modality -> ephemeris route segment
const ROUTES: Record<string, string> = {
  western: "western",
  vedic: "vedic",
  human_design: "human-design",
  gene_keys: "gene-keys",
};

export async function computeChart(modality: string, birth: BirthInput): Promise<ChartResponse> {
  const route = ROUTES[modality];
  if (!route) throw new Error(`unknown modality: ${modality}`);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = TOKEN();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE()}/charts/${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(birth),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ephemeris ${modality} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ChartResponse;
}

export async function computeSynastry(a: BirthInput, b: BirthInput): Promise<unknown> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = TOKEN();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE()}/charts/synastry`, {
    method: "POST",
    headers,
    body: JSON.stringify({ a, b }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ephemeris synastry failed: ${res.status}`);
  return res.json();
}

export async function ephemerisHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE()}/healthz`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
