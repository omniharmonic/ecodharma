import { loadPublicCard } from "@/lib/share";
import { renderCard, SIZES, type SizeKey } from "@/lib/og-card";

// Node runtime: og-card reads the bundled TTFs off disk (see next.config
// outputFileTracingIncludes → public/fonts/**).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const card = await loadPublicCard(params.token);
  if (!card) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const requested = url.searchParams.get("size") as SizeKey | null;
  const size: SizeKey = requested && requested in SIZES ? requested : "og";

  return renderCard({
    size,
    recognition: card.recognition,
    archetypes: card.archetypes,
  });
}
