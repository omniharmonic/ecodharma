import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { isPremium } from "@/lib/billing";
import { loadFramework } from "@/lib/framework";
import { MessageForm } from "@/components/MessageForm";
import { ShareCard } from "@/components/ShareCard";
import { ResonanceButtons } from "@/components/ResonanceButtons";
import { PageTransition, SectionReveal } from "@/components/PageTransition";
import { NatalWheel } from "@/components/charts/NatalWheel";
import BodyGraph from "@/components/charts/BodyGraph";
import GeneKeysViz from "@/components/charts/GeneKeysViz";
import { TermPane } from "@/components/Terminal";
import { regenerateProfileAction } from "../actions/profile";
import type { ChartLens, ChartThread, GiftProfile } from "@/lib/types";

// re-draft's server action calls Claude — give it the full function budget.
export const maxDuration = 300;

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const fw = loadFramework();
  const domainName = (id: string) => fw.domains.find((d) => d.id === id)?.name || id;
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;

  const { profile, charts, birth, shareToken } = await withUser(user!.id, async (c) => {
    const p = await c.query(
      "select content_json, framework_version, voice_version, generated_at from gift_profiles where user_id=$1 order by generated_at desc limit 1",
      [user!.id],
    );
    const ch = await c.query("select modality, raw_json from charts where user_id=$1", [user!.id]);
    const bd = await c.query("select to_char(birth_date,'FMDD Mon YYYY') as birth_date, to_char(birth_time,'HH24:MI') as birth_time, unknown_time, place_label, round(lat::numeric,3) as lat, round(lng::numeric,3) as lng, tz_str from birth_data where user_id=$1", [user!.id]);
    const pr = await c.query("select share_token from profiles where id=$1", [user!.id]);
    const chartMap: Record<string, any> = {};
    for (const row of ch.rows) chartMap[row.modality] = row.raw_json;
    return { profile: p.rows[0], charts: chartMap, birth: bd.rows[0], shareToken: (pr.rows[0]?.share_token as string | null) ?? null };
  });
  const premium = await isPremium(user!.id);

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
  const lensReadings = gp.lens_readings || [];

  return (
    <PageTransition>
      {/* RECOGNITION — the one thing, in plain language */}
      <section className="max-w-measure pt-12 animate-rise">
        <p className="eyebrow mb-4">Your reading</p>
        <p className="font-display text-[1.6rem] leading-[1.22] text-fg sm:text-[2.1rem] sm:leading-[1.18] md:text-[2.6rem] md:leading-[1.15]" data-testid="recognition">
          {gp.recognition}
        </p>
      </section>

      {/* SHARE — surfaced high to encourage sharing; collapsible for those who'd rather not. */}
      <section className="mt-8 max-w-measure">
        <ShareCard token={shareToken} collapsible />
      </section>

      {/* BIRTH DETAILS — verify these; a wrong city silently breaks every chart. */}
      {birth && (
        <section className="mt-8 max-w-measure" data-testid="birth-details">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-rule/15 pt-4 text-sm">
            <span className="eyebrow">Computed from</span>
            <span className="text-fg">{birth.birth_date}</span>
            <span className="text-muted/50">·</span>
            <span className="text-fg">{birth.unknown_time ? "time unknown" : birth.birth_time}</span>
            <span className="text-muted/50">·</span>
            <span className="text-fg">{birth.place_label || `${birth.lat}, ${birth.lng}`}</span>
            <span className="kv">({birth.tz_str})</span>
            <Link href="/onboarding" className="ml-1 font-mono text-2xs uppercase tracking-eyebrow text-accent hover:underline" data-testid="edit-birth">
              Correct these →
            </Link>
          </div>
          <p className="mt-1.5 text-2xs text-muted/70">
            If the city or time is wrong, correct it — the ascendant, Human Design, and Gene Keys all depend on it.
          </p>
        </section>
      )}

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

      {/* CHART, LENS BY LENS — deep per-lens readings, each a two-column spread */}
      {lensReadings.length > 0 && (
        <SectionReveal className="mt-24 max-w-4xl" index={2}>
          <p className="eyebrow mb-2">Your chart, lens by lens</p>
          <p className="mb-8 max-w-measure text-sm text-muted">
            Each tradition read in full — your actual placements, and what each one equips you to do in the turning.
          </p>
          <div className="space-y-8">
            {lensReadings.map((lr) => (
              <div key={lr.lens} className="crt-frame p-6 pt-9 md:p-8 md:pt-10" data-title={lr.title} data-testid={`lens-reading-${lr.lens}`}>
                <div data-testid="lens-reading" className="md:grid md:grid-cols-[1.05fr_0.95fr] md:gap-10">
                  <div>
                    {lr.summary && <p className="font-mono text-2xs uppercase leading-relaxed tracking-eyebrow text-accent">{lr.summary}</p>}
                    <div className="mt-4 whitespace-pre-line font-sans leading-relaxed text-fg/90">{lr.reading}</div>
                  </div>
                  {lr.placements?.length > 0 && (
                    <ul className="mt-8 divide-y divide-rule/12 border-t border-rule/12 md:mt-0 md:border-t-0 md:border-l md:border-rule/15 md:pl-8">
                      {lr.placements.map((p, i) => (
                        <li key={i} className="py-3.5 first:pt-0 md:py-3" data-testid="lens-placement">
                          <p className="font-mono text-sm text-accent">{p.label}</p>
                          <p className="mt-1 text-sm text-fg/90">{p.meaning}</p>
                          <p className="mt-1 text-sm text-muted">
                            <span className="text-live">→ </span>{p.great_turning}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionReveal>
      )}

      {/* GIFT CONSTELLATION — the 2–3 archetypes most alive, and how you carry each */}
      {constellation.length > 0 && (
        <SectionReveal className="mt-16 max-w-4xl" index={2}>
          <p className="eyebrow mb-4">Your gift constellation</p>
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {constellation.map((g, i) => (
              <div key={i} data-testid="gift-carry">
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
      </section>

      {/* APPARATUS — re-draft (premium) + telemetry */}
      <section className="mt-20 max-w-measure border-t border-rule/15 pt-8">
        <div className="flex flex-wrap items-center gap-4">
          {premium ? (
            <MessageForm action={regenerateProfileAction} submitLabel="re-draft profile" pendingLabel="re-drafting…" className="btn-line" />
          ) : (
            <Link href="/settings" className="btn-line" data-testid="redraft-locked">
              Re-draft profile → premium
            </Link>
          )}
          <span className="font-mono text-2xs text-muted/70" data-testid="profile-version">
            framework v{profile.framework_version} · {profile.voice_version}
          </span>
        </div>
        {!premium && (
          <p className="mt-3 max-w-prose text-2xs text-muted/70">
            Your first reading is yours to keep. Re-drafting runs the full AI interpretation again —
            available to premium members.
          </p>
        )}
      </section>
    </PageTransition>
  );
}

function ChartPlate({ title, testid, children }: { title: string; testid?: string; children: React.ReactNode }) {
  // Split "Fig. A · Natal wheel — tropical" into a corner tag + a title.
  const [tag, ...rest] = title.split(" · ");
  return (
    <TermPane title={rest.join(" · ") || title} corner={tag} testid={testid}>
      {children}
    </TermPane>
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
