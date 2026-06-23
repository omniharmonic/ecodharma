import Link from "next/link";
import { getUser } from "@/lib/auth";
import { loadFramework } from "@/lib/framework";
import { AsciiEarth } from "@/components/AsciiEarth";
import { TermPane, Ascii, AsciiDivider } from "@/components/Terminal";
import { SEED_EARTH } from "@/components/ascii/art";

export default async function Home() {
  const user = await getUser();
  const fw = loadFramework();

  return (
    <div className="pt-10">
      {/* HERO — one bold statement, framed as a terminal session */}
      <section className="grid items-center gap-10 md:grid-cols-[1fr_1fr]">
        <div className="animate-rise">
          <div className="mb-6 flex items-end gap-4">
            <Ascii art={SEED_EARTH} glow="solar" label="seed within the whole earth" className="shrink-0 text-[0.5rem] leading-[1.05] sm:text-[0.62rem]" />
            <p className="eyebrow pb-1 leading-relaxed">access to gifts<br /><span className="text-muted/70">a field terminal for the<br />Great Turning</span></p>
          </div>
          <h1 className="mt-5 font-display text-mega leading-[0.95] text-fg">
            The work that is <span className="text-accent">only yours</span>.
          </h1>
          <p className="mt-6 max-w-measure font-sans text-lg text-muted">
            EcoDharma reads you through several lenses and reflects back where your particular gifts
            meet what the world needs — and one small move you could make next.
          </p>
          <div className="mt-7 font-mono text-sm">
            <p className="text-muted">
              <span className="term-prompt-user">eco@dharma</span><span className="text-muted">:</span><span className="term-prompt-sigil">$</span>{" "}
              <Link href={user ? "/onboarding" : "/signup"} className="text-fg underline decoration-accent/50 underline-offset-4 hover:text-accent" data-testid="cta-begin">
                {user ? "reading --compute" : "reading --begin"}
              </Link>
              <span className="caret" aria-hidden />
            </p>
            <p className="mt-2 text-muted">
              <span className="term-prompt-user">eco@dharma</span><span className="text-muted">:</span><span className="term-prompt-sigil">$</span>{" "}
              <Link href="/profile" className="text-fg/80 underline decoration-rule/40 underline-offset-4 hover:text-accent">
                open ~/field-manual
              </Link>
            </p>
          </div>
          <p className="mt-8 font-mono text-2xs uppercase tracking-eyebrow text-muted">
            ⊢&nbsp; {fw.domains.length} domains · {fw.gifts.length} gifts · {fw.trim_tabs.length}+ trim-tabs &nbsp;⊣
          </p>
        </div>

        <TermPane title="whole-earth · live ephemeris" corner="live" grain className="crt-live">
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
    </div>
  );
}
