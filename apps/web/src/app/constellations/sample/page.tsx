import Link from "next/link";
import { DymaxionMap } from "@/components/DymaxionMap";
import { ConstellationRelational } from "@/components/ConstellationRelational";
import { SAMPLE_CONSTELLATIONS, getSampleConstellation } from "@/lib/mock";

export const metadata = {
  title: "Sample constellation — EcoDharma",
  description:
    "A sample constellation read, so you can see how a group's gifts get woven before inviting real kin.",
};

// Public demo — no auth, no DB. Renders a fully-populated sample read using the
// same visual treatment as the real /constellations/[id] detail page.
export default function SampleConstellationPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const constellation = getSampleConstellation(searchParams.c);
  const { read, members } = constellation;
  const names = members.map((m) => m.display_name);

  return (
    <div className="max-w-5xl pt-12">
      <div className="flex flex-wrap items-start justify-between gap-4 animate-rise">
        <div className="max-w-measure">
          <p className="eyebrow mb-4">Sample constellation</p>
          <h1 className="font-display text-title leading-[1.05] text-fg sm:text-hero">{constellation.name}</h1>
          <p className="mt-4 text-lg text-muted">{constellation.tagline}</p>
        </div>
        <Link href="/constellations" className="btn-line shrink-0">← Back</Link>
      </div>

      {/* Switcher chips — change which sample is shown */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Choose a sample constellation">
        {SAMPLE_CONSTELLATIONS.map((c) => {
          const active = c.slug === constellation.slug;
          return (
            <Link
              key={c.slug}
              href={`/constellations/sample?c=${c.slug}`}
              className={active ? "pill pill-solar" : "btn-line"}
              aria-current={active ? "page" : undefined}
            >
              {c.name}
            </Link>
          );
        })}
      </nav>

      {/* Member roster — a scannable grid of who's woven in */}
      <section className="mt-16">
        <p className="eyebrow mb-5">Woven in · {members.length}</p>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {members.map((m) => (
            <div key={m.display_name} className="border-t border-rule/15 pt-4" data-testid="sample-member-row">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-display text-fig text-fg">{m.display_name}</span>
                <span className="pill">{m.archetype}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{m.profile}</p>
              {m.placements && <p className="kv mt-1.5">{m.placements}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20" data-testid="constellation-read">
        <p className="eyebrow mb-5">The constellation, woven</p>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <figure className="plate lg:sticky lg:top-6">
            <figcaption className="fig mb-2">The field, mapped</figcaption>
            <DymaxionMap names={names} />
          </figure>
          <p className="whitespace-pre-line text-lg leading-relaxed text-fg">{read.narrative}</p>
        </div>

        <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2">
          <ReadList title="Collective gifts" items={read.collective_gifts} />
          <ReadList title="Complementarities" items={read.complementarities} />
          <ReadList title="Frictions to name" items={read.frictions} />
          <ReadList title="Gaps in the field" items={read.gaps} />
          <ReadList title="Make explicit" items={read.make_explicit} />
        </div>

        {read.pairwise && read.pairwise.length > 0 && (
          <div className="mt-12">
            <p className="eyebrow mb-4">Pairwise dynamics</p>
            <div className="divide-y divide-rule/12">
              {read.pairwise.map((p, i) => (
                <div key={i} className="py-4">
                  <h3 className="font-display text-lg text-fg">{p.a} &amp; {p.b}</h3>
                  <p className="mt-1 text-muted">{p.dynamic}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 border-l-2 border-accent pl-5">
          <p className="eyebrow mb-2">Weaving guidance</p>
          <p className="text-fg">{read.weaving_guidance}</p>
        </div>

        <ConstellationRelational relational={read.relational} />
      </section>

      <section className="mt-20 border-t border-rule/15 pt-8">
        <p className="text-sm text-muted">
          This is a sample, woven from imagined members. Your own constellation read is generated only
          from people who have actively consented to be woven in.
        </p>
        <Link href="/constellations" className="btn-solar mt-4 inline-block">Compose your own</Link>
      </section>
    </div>
  );
}

function ReadList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <ul className="divide-y divide-rule/12">
        {items.map((it, i) => <li key={i} className="py-2 text-muted">{it}</li>)}
      </ul>
    </div>
  );
}
