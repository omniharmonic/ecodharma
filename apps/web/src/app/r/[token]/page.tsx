import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPublicCard } from "@/lib/share";

// A PUBLIC, unauthenticated share page. It shows only the whitelisted card data
// (recognition opener + archetypes) and drives new signups. The full reading
// never leaves the server.
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const card = await loadPublicCard(params.token);
  if (!card) return { title: "EcoDharma" };
  const title = "An EcoDharma reading";
  const description = card.recognition || card.archetypes.join(" · ");
  const image = `${SITE}/api/og/${params.token}?size=og`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/r/${params.token}`,
      siteName: "EcoDharma",
      images: [{ url: image, width: 1200, height: 630 }],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const card = await loadPublicCard(params.token);
  if (!card) notFound();

  return (
    <div className="mx-auto max-w-measure px-5 pt-16 pb-24">
      <p className="eyebrow mb-6">EcoDharma · shared reading</p>

      <figure className="crt-frame p-6 pt-9 md:p-10 md:pt-12">
        <p className="font-display text-2xl leading-snug text-fg md:text-3xl">{card.recognition}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          {card.archetypes.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-2 border border-accent/50 px-3.5 py-1.5 font-mono text-2xs uppercase tracking-eyebrow text-[color:rgb(var(--solar-ink))]"
            >
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-[color:rgb(var(--live))]" />
              {a}
            </span>
          ))}
        </div>
      </figure>

      <section className="mt-14 border-t border-rule/15 pt-10 text-center">
        <p className="font-display text-xl text-fg md:text-2xl">
          Everyone carries a gift the world needs now.
        </p>
        <p className="mx-auto mt-3 max-w-prose text-muted">
          EcoDharma reads your astrology, Human Design, and Gene Keys through the Great Turning —
          reflecting the work that is only yours. Your first reading is free.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-4">
          <Link href="/signup" className="btn-solar">Discover your own gifts →</Link>
          <Link href="/" className="btn-line">What is this?</Link>
        </div>
      </section>
    </div>
  );
}
