import Link from "next/link";
import { getUser } from "@/lib/auth";
import { loadFramework } from "@/lib/framework";
import { AsciiEarth } from "@/components/AsciiEarth";
import { TermPane, AsciiDivider } from "@/components/Terminal";

export default async function Home() {
  const user = await getUser();
  const fw = loadFramework();

  return (
    <div className="pt-10">
      {/* HERO — one clear statement, a quiet kicker, the living earth alongside */}
      <section className="grid items-center gap-10 pt-6 md:grid-cols-[1fr_1fr]">
        <div className="animate-rise">
          <p className="eyebrow mb-5">A field guide for the Great Turning</p>
          <h1 className="font-display text-mega leading-[0.95] text-fg">
            The work that is <span className="text-accent">only yours</span>.
          </h1>
          <p className="mt-6 max-w-measure font-sans text-lg text-muted">
            EcoDharma reads you through several lenses and reflects back where your particular gifts
            meet what the world needs — and one small move you could make next.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={user ? "/onboarding" : "/signup"} className="btn-solar" data-testid="cta-begin">
              {user ? "Compute your reading" : "Begin your reading"}
            </Link>
            <Link href="/profile" className="btn-line">
              Open your field guide
            </Link>
          </div>
          <p className="mt-9 font-mono text-2xs uppercase tracking-eyebrow text-muted/80">
            {fw.domains.length} domains · {fw.gifts.length} gifts · {fw.trim_tabs.length} trim-tabs
          </p>
        </div>

        <TermPane title="The whole earth" grain className="crt-live">
          <AsciiEarth
            fit
            speed={0.16}
            className="mx-auto phosphor-live text-[0.5rem] leading-[0.92] sm:text-[0.6rem]"
          />
        </TermPane>
      </section>

      <div className="mt-20"><AsciiDivider /></div>

      {/* THE THREE DIMENSIONS — Macy's spine, stated plainly */}
      {fw.dimensions && fw.dimensions.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow mb-6">Three ways to help — after Joanna Macy&rsquo;s Great Turning</p>
          <div className="grid gap-px border border-rule/15 bg-rule/15 md:grid-cols-3">
            {fw.dimensions.map((d, i) => (
              <div key={d.id} className="bg-bg p-6">
                <p className="fig">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 font-display text-fig text-fg">{d.name}</h3>
                <p className="mt-2 font-sans text-sm text-muted">{d.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* THE FRAMEWORK — quiet, expansive */}
      <section className="mt-28 max-w-measure">
        <p className="eyebrow mb-4">The framework</p>
        <p className="font-sans text-lg leading-relaxed text-fg">{fw.summary}</p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1">
          {fw.gifts.map((g) => (
            <span key={g.id} className="font-mono text-2xs uppercase tracking-eyebrow text-muted">
              {g.name}
            </span>
          ))}
        </div>
        {fw.lineage && (
          <p className="mt-8 font-mono text-2xs text-muted/70">
            In the lineage of {fw.lineage.map((l) => l.name).join(" · ")} · framework v{fw.framework_version} · CC BY-SA
          </p>
        )}
      </section>

      {/* HOW IT WORKS — the free core, and the membership that deepens it */}
      <div className="mt-28"><AsciiDivider /></div>
      <section className="mt-12">
        <p className="eyebrow mb-4">How it works</p>
        <p className="max-w-measure font-sans text-lg leading-relaxed text-fg">
          Take your reading for free. It stays yours. Membership is for those who want the reading to
          become an ongoing companion — something you can think with, not just read once.
        </p>

        <div className="mt-10 grid gap-px border border-rule/15 bg-rule/15 md:grid-cols-2">
          {/* FREE */}
          <div className="bg-bg p-7">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-fig text-fg">The reading</h3>
              <span className="font-mono text-2xs uppercase tracking-eyebrow text-muted">Free, always</span>
            </div>
            <ul className="mt-5 space-y-3 font-sans text-sm text-muted">
              {[
                "Your charts across four traditions — Western & Vedic astrology, Human Design, Gene Keys.",
                "A deep reading of them, lens by lens, mapped to your part in the Great Turning.",
                "Weave constellations with others — no one is ever included without their active consent.",
                "A beautiful, shareable card of your reading.",
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 text-live" aria-hidden>·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* MEMBERSHIP */}
          <div className="bg-bg p-7">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-fig text-accent">Membership</h3>
              <span className="font-mono text-2xs uppercase tracking-eyebrow text-accent">$15 / month</span>
            </div>
            <ul className="mt-5 space-y-3 font-sans text-sm text-muted">
              {[
                "Reflect with your profile any time — over Telegram, or your own AI tool (Claude and others).",
                "Relational reflection across your constellations — “how do I meet this person well right now?”",
                "A weekly dharma nudge, tuned to your gifts and the work that is yours.",
                "Re-draft your reading whenever you’ve grown into a new season.",
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 text-accent" aria-hidden>·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href={user ? "/onboarding" : "/signup"} className="btn-solar">
            {user ? "Compute your reading" : "Begin — it’s free"}
          </Link>
          <Link href="/settings" className="btn-line">See membership</Link>
        </div>
        <p className="mt-6 font-mono text-2xs text-muted/70">
          Your first reading and your four charts are yours to keep, free, forever. Membership sustains the work.
        </p>
      </section>
    </div>
  );
}
