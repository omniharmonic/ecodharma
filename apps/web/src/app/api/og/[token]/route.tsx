import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPublicCard } from "@/lib/share";

// Node runtime: we read the bundled TTFs off disk (see next.config
// outputFileTracingIncludes → public/fonts/**).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EcoDharma palette (blueprint / cyanotype printing — reads best as a card).
const GROUND = "#0A272B";
const DEEP = "#071B1F";
const CHALK = "#DCE8E0";
const SOLAR = "#E8A13A";
const PHOSPHOR = "#9BE8B0";
const CYAN = "#4FA3B8";

type SizeKey = "og" | "square" | "story";
const SIZES: Record<SizeKey, { w: number; h: number }> = {
  og: { w: 1200, h: 630 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

function fontFile(name: string): Buffer {
  // cwd is the function root on Vercel; try a couple of candidates for dev too.
  const candidates = [
    join(process.cwd(), "public/fonts", name),
    join(process.cwd(), "apps/web/public/fonts", name),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p);
    } catch {
      /* try next */
    }
  }
  throw new Error(`font not found: ${name}`);
}

const fraunces = fontFile("Fraunces-SemiBold.ttf");
const plex = fontFile("IBMPlexMono-Medium.ttf");

function clamp(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/[\s,.;:]+\S*$/, "") + "…";
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const card = await loadPublicCard(params.token);
  if (!card) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const size = (url.searchParams.get("size") as SizeKey) || "og";
  const { w, h } = SIZES[size] ?? SIZES.og;
  const tall = h >= w; // square / story

  // Per-format tuning so nothing overflows any card (square is the tightest:
  // 1080² with header + footer eating the vertical budget).
  const MAXCHARS: Record<SizeKey, number> = { og: 150, square: 170, story: 320 };
  const TITLE: Record<SizeKey, number> = { og: 48, square: 52, story: 76 };
  const PILL: Record<SizeKey, number> = { og: 26, square: 24, story: 30 };
  const recognition = clamp(card.recognition || "A field manual for the work that is only yours.", MAXCHARS[size] ?? 150);
  const archetypes = card.archetypes.length ? card.archetypes : ["Your gifts"];

  const pad = tall ? 90 : 76;
  const titleSize = TITLE[size] ?? 48;
  const eyebrowSize = tall ? 26 : 21;

  return new ImageResponse(
    (
      <div
        style={{
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          backgroundColor: GROUND,
          backgroundImage: `linear-gradient(180deg, ${GROUND} 0%, ${DEEP} 100%)`,
          fontFamily: "IBM Plex Mono",
          position: "relative",
        }}
      >
        {/* atmospheric glows (single radial each — Satori-safe) */}
        <div style={{ position: "absolute", top: -260, right: -200, width: 760, height: 760, display: "flex", backgroundImage: "radial-gradient(circle at center, rgba(232,161,58,0.20), rgba(232,161,58,0) 60%)" }} />
        <div style={{ position: "absolute", bottom: -300, left: -220, width: 760, height: 760, display: "flex", backgroundImage: "radial-gradient(circle at center, rgba(155,232,176,0.12), rgba(155,232,176,0) 60%)" }} />

        {/* faint hairline frame */}
        <div
          style={{
            position: "absolute",
            top: pad * 0.55,
            left: pad * 0.55,
            right: pad * 0.55,
            bottom: pad * 0.55,
            border: `1px solid rgba(79,163,184,0.28)`,
            display: "flex",
          }}
        />

        {/* geodesic corner motif — concentric rings + a struck triangle */}
        <div style={{ position: "absolute", top: -180, right: -180, width: 520, height: 520, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 520, border: `1px solid rgba(79,163,184,0.22)`, display: "flex" }} />
          <div style={{ position: "absolute", width: 380, height: 380, borderRadius: 380, border: `1px solid rgba(79,163,184,0.28)`, display: "flex" }} />
          <div style={{ position: "absolute", width: 240, height: 240, borderRadius: 240, border: `1px solid rgba(232,161,58,0.5)`, display: "flex" }} />
        </div>

        {/* header eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: CYAN, letterSpacing: 4, fontSize: eyebrowSize, textTransform: "uppercase" }}>
          <div style={{ width: 46, height: 2, backgroundColor: SOLAR, display: "flex" }} />
          <span>EcoDharma · The work that is only yours</span>
        </div>

        {/* body: recognition line */}
        <div style={{ display: "flex", flexDirection: "column", gap: tall ? 40 : 26, marginTop: "auto", marginBottom: "auto" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              color: CHALK,
              fontSize: titleSize,
              lineHeight: 1.2,
              letterSpacing: -0.5,
              maxWidth: tall ? 920 : 1010,
            }}
          >
            {recognition}
          </div>

          {/* archetype tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
            {archetypes.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 22px",
                  border: `1px solid rgba(232,161,58,0.55)`,
                  color: SOLAR,
                  fontSize: PILL[size] ?? 26,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                <div style={{ width: 8, height: 8, backgroundColor: PHOSPHOR, display: "flex" }} />
                {a}
              </div>
            ))}
          </div>
        </div>

        {/* footer — CTA on the left so its arrow points at the URL on the right */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: SOLAR, fontSize: tall ? 28 : 24, letterSpacing: 3, textTransform: "uppercase" }}>
            <span>Get your free reading</span>
            <span style={{ display: "flex", color: PHOSPHOR }}>→</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Fraunces", color: CHALK, fontSize: tall ? 40 : 34, letterSpacing: -0.5 }}>
            ecodharma.xyz
          </div>
        </div>
      </div>
    ),
    {
      width: w,
      height: h,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
        { name: "IBM Plex Mono", data: plex, weight: 500, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
