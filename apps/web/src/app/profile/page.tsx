import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { loadFramework } from "@/lib/framework";
import { MessageForm } from "@/components/MessageForm";
import { ResonanceButtons } from "@/components/ResonanceButtons";
import { PageTransition, SectionReveal } from "@/components/PageTransition";
import { NatalWheel } from "@/components/charts/NatalWheel";
import BodyGraph from "@/components/charts/BodyGraph";
import GeneKeysViz from "@/components/charts/GeneKeysViz";
import { regenerateProfileAction, saveOfferingsAction } from "../actions/profile";
import type { ChartLens, ChartThread, GiftProfile } from "@/lib/types";

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const fw = loadFramework();
  const domainName = (id: string) => fw.domains.find((d) => d.id === id)?.name || id;
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;

  const { profile, offerings, charts } = await withUser(user!.id, async (c) => {
    const p = await c.query(
      "select content_json, framework_version, voice_version, generated_at from gift_profiles where user_id=$1 order by generated_at desc limit 1",
      [user!.id],
    );
    const o = await c.query("select skills, offerings, availability from offerings where user_id=$1", [user!.id]);
    const ch = await c.query("select modality, raw_json from charts where user_id=$1", [user!.id]);
    const chartMap: Record<string, any> = {};
    for (const row of ch.rows) chartMap[row.modality] = row.raw_json;
    return { profile: p.rows[0], offerings: o.rows[0], charts: chartMap };
  });

  if (!profile) {
    return (
      <div className="mx-auto mt-24 max-w-measure text-center">
        <p className="eyebrow">No reading yet</p>
        <h1 className="mt-3 font-display text-title text-fg">The work that is only yours is waiting to be drawn.</h1>
        <Link href="/onboarding" className="btn-solar mt-6">Compute my reading</Link>
      </div>
    );
  }

  const gp = profile.content_json as GiftProfile;
  const [lead, ...more] = gp.trim_tabs || [];
  const threads = gp.chart_threads || [];
  const threadsFor = (m: ChartLens) => threads.filter((t) => t.modality === m);
  const constellation = gp.gift_constellation || [];

  return (
    <PageTransition>
      {/* RECOGNITION — the one thing, in plain language */}
      <section className="max-w-measure pt-10 animate-rise">
        <p className="eyebrow mb-4">The work that is only yours</p>
        <p className="font-display text-title leading-[1.15] text-fg md:text-[2.6rem]" data-testid="recognition">
          {gp.recognition}
        </p>
      </section>

      {/* THE CHARTS, READ — real visuals with the interpretive layer woven on top */}
      {(charts.western || charts.human_design || charts.gene_keys) && (
        <SectionReveal className="mt-20" index={0}>
          <p className="eyebrow mb-2">Your charts, read</p>
          <p className="mb-8 max-w-measure text-sm text-muted">
            Four lenses on the same person. The numbered notes connect a specific placement to how you can take part —
            mirrors for reflection, not verdicts.
          </p>

          <div className="grid gap-10 lg:grid-cols-2" data-testid="chart-visuals">
            {charts.western && (
              <ChartPlate title="Fig. A · Natal wheel — tropical" testid="chart-natal-western">
                <NatalWheel
                  positions={charts.western.positions}
                  houses={charts.western.houses}
                  aspects={charts.western.aspects}
                  annotations={threads as any}
                  size={360}
                  className="mx-auto"
                />
                <Legend prefix="A" items={threadsFor("western")} />
              </ChartPlate>
            )}

            {charts.vedic && (
              <ChartPlate title="Fig. A′ · Natal wheel — sidereal" testid="chart-natal-vedic">
                <NatalWheel
                  positions={charts.vedic.positions}
                  houses={charts.vedic.houses}
                  aspects={charts.vedic.aspects}
                  system="vedic"
                  ayanamsa={charts.vedic.ayanamsa}
                  annotations={threads as any}
                  size={360}
                  className="mx-auto"
                />
                <Legend prefix="A" items={threadsFor("vedic")} />
              </ChartPlate>
            )}

            {charts.human_design && (
              <ChartPlate title="Fig. B · Human Design bodygraph" testid="chart-bodygraph">
                <BodyGraph hd={charts.human_design} annotations={threads as any} size={320} className="mx-auto" />
                <Legend prefix="B" items={threadsFor("human_design")} />
              </ChartPlate>
            )}

            {charts.gene_keys && (
              <ChartPlate title="Fig. C · Gene Keys — core sequences" testid="chart-genekeys">
                <GeneKeysViz geneKeys={charts.gene_keys} annotations={threads as any} size={420} className="mx-auto" />
                <Legend prefix="C" items={threadsFor("gene_keys")} />
              </ChartPlate>
            )}
          </div>
        </SectionReveal>
      )}

      {/* THE DEEP READING — the portrait that weaves all four lenses */}
      {gp.portrait && (
        <SectionReveal className="mt-20 max-w-measure" index={1}>
          <p className="eyebrow mb-4">The reading</p>
          <div className="whitespace-pre-line font-sans text-lg leading-relaxed text-fg" data-testid="profile-portrait">
            {gp.portrait}
          </div>
        </SectionReveal>
      )}

      {/* GIFT CONSTELLATION — the 2–3 archetypes most alive, and how you carry each */}
      {constellation.length > 0 && (
        <SectionReveal className="mt-16 max-w-measure" index={2}>
          <p className="eyebrow mb-4">Your gift constellation</p>
          <div className="divide-y divide-rule/12">
            {constellation.map((g, i) => (
              <div key={i} className="py-5" data-testid="gift-carry">
                <h3 className="font-display text-fig text-fg">{giftName(g.gift_id)}</h3>
                <p className="mt-2 font-sans leading-relaxed text-muted">{g.how_they_carry}</p>
              </div>
            ))}
          </div>
        </SectionReveal>
      )}

      {/* LEAD MOVE — the single most-alive next step */}
      {lead && (
        <SectionReveal className="mt-16 max-w-measure" index={3}>
          <p className="eyebrow mb-3">Your next move</p>
          <div className="border-l-2 border-accent pl-5" data-testid="trim-tab">
            <p className="font-sans text-fig leading-snug text-fg">{lead.action}</p>
            {lead.upward_spiral && <p className="mt-3 font-sans text-base text-muted">{lead.upward_spiral}</p>}
            {lead.ikigai_fit && <p className="mt-2 font-sans text-sm text-muted/80">{lead.ikigai_fit}</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              <span className="pill pill-solar">{domainName(lead.domain_id)}</span>
              {lead.gift_basis && <span className="pill">{lead.gift_basis}</span>}
            </div>
            <ResonanceButtons trimTabId={lead.trim_tab_id} />
          </div>
        </SectionReveal>
      )}

      {/* WHAT'S UNIQUELY YOURS — short phrases, quiet */}
      <section className="mt-16 max-w-measure">
        <p className="eyebrow mb-4">What&rsquo;s uniquely yours</p>
        <ul className="divide-y divide-rule/12">
          {gp.unique_gifts.map((g, i) => (
            <li key={i} className="py-3 font-sans text-fg" data-testid="gift-item">
              {g}
            </li>
          ))}
        </ul>
      </section>

      {/* MORE MOVES */}
      {more.length > 0 && (
        <section className="mt-16 max-w-measure">
          <p className="eyebrow mb-4">Two more places it could land</p>
          <div className="divide-y divide-rule/12">
            {more.map((t, i) => (
              <div key={i} className="py-5" data-testid="trim-tab">
                <p className="font-sans text-lg text-fg">{t.action}</p>
                {t.upward_spiral && <p className="mt-2 font-sans text-sm text-muted">{t.upward_spiral}</p>}
                <div className="mt-2 flex flex-wrap gap-3">
                  <span className="pill pill-solar">{domainName(t.domain_id)}</span>
                  {t.gift_basis && <span className="pill">{t.gift_basis}</span>}
                </div>
                <ResonanceButtons trimTabId={t.trim_tab_id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ORIENTATIONS — how you tend to move */}
      {gp.orientations && gp.orientations.length > 0 && (
        <section className="mt-16 max-w-measure">
          <p className="eyebrow mb-4">How you tend to move</p>
          <div className="flex flex-wrap gap-2">
            {gp.orientations.map((o, i) => (
              <span key={i} className="pill" data-testid="orientation-item">{o}</span>
            ))}
          </div>
        </section>
      )}

      {/* PROGRESSIVE DISCLOSURE — framework recedes to support */}
      <section className="mt-16 max-w-measure space-y-1">
        <Disclosure label="Where this fits the bigger work">
          <ul className="divide-y divide-rule/12">
            {gp.domains.map((d, i) => (
              <li key={i} className="py-3" data-testid="domain-item">
                <span className="font-sans text-fg">{domainName(d.domain_id)}</span>
                <span className="font-sans text-muted"> — {d.why}</span>
              </li>
            ))}
          </ul>
        </Disclosure>

        {(gp.edges?.length || gp.shadow?.length) > 0 && (
          <Disclosure label="Edges to tend">
            <ul className="divide-y divide-rule/12">
              {(gp.edges?.length ? gp.edges : gp.shadow).map((s, i) => (
                <li key={i} className="py-3" data-testid="shadow-item">
                  <span className="font-sans text-fg">{s.pattern}</span>
                  <span className="font-sans text-muted"> {s.how_to_relate}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        {gp.narrative && (
          <Disclosure label="A closing word">
            <p className="whitespace-pre-line font-sans leading-relaxed text-muted" data-testid="profile-narrative">
              {gp.narrative}
            </p>
          </Disclosure>
        )}
      </section>

      {/* FIND YOUR PEOPLE */}
      <section className="mt-16 flex max-w-measure flex-wrap gap-4">
        <Link href="/constellations" className="btn-line">weave a constellation</Link>
        <Link href="/work" className="btn-line">find aligned work</Link>
      </section>

      {/* APPARATUS — offerings + re-draft + telemetry, clearly separated */}
      <section className="mt-20 max-w-measure border-t border-rule/15 pt-8 space-y-6">
        <div>
          <p className="eyebrow mb-3">What you bring</p>
          <MessageForm action={saveOfferingsAction} submitLabel="save offerings" pendingLabel="saving…" className="btn-line">
            <div><label className="label" htmlFor="skills">Skills</label><input id="skills" name="skills" className="input" defaultValue={(offerings?.skills || []).join(", ")} /></div>
            <div><label className="label" htmlFor="offerings">Offerings</label><input id="offerings" name="offerings" className="input" defaultValue={(offerings?.offerings || []).join(", ")} /></div>
            <div><label className="label" htmlFor="availability">Availability</label><input id="availability" name="availability" className="input" defaultValue={offerings?.availability || ""} /></div>
          </MessageForm>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <MessageForm action={regenerateProfileAction} submitLabel="re-draft profile" pendingLabel="re-drafting…" className="btn-line" />
          <span className="font-mono text-2xs text-muted/70" data-testid="profile-version">
            framework v{profile.framework_version} · {profile.voice_version}
          </span>
        </div>
      </section>
    </PageTransition>
  );
}

function ChartPlate({ title, testid, children }: { title: string; testid?: string; children: React.ReactNode }) {
  return (
    <figure className="crt-frame" data-title={title} data-testid={testid}>
      <div className="crt-screen">{children}</div>
    </figure>
  );
}

function Legend({ prefix, items }: { prefix: string; items: ChartThread[] }) {
  if (!items.length) return null;
  return (
    <ol className="mt-5 space-y-2 border-t border-rule/12 pt-4">
      {items.map((t, i) => (
        <li key={i} className="text-sm leading-snug" data-testid="chart-thread">
          <span className="font-mono text-2xs text-accent">{prefix}.{i + 1}</span>{" "}
          <span className="font-sans text-fg">{t.placement}</span>
          <span className="font-sans text-muted"> — {t.great_turning_link}</span>
        </li>
      ))}
    </ol>
  );
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-rule/15 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-accent">
        {label}
        <span className="text-accent transition-transform group-open:rotate-45" aria-hidden>+</span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
