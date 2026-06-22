import Link from "next/link";
import { getUser } from "@/lib/auth";
import { loadFramework } from "@/lib/framework";
import { AsciiEarth } from "@/components/AsciiEarth";

export default async function Home() {
  const user = await getUser();
  const fw = loadFramework();

  return (
    <div className="pt-10">
      {/* HERO — one bold statement on an open sheet */}
      <section className="grid items-center gap-10 md:grid-cols-[1fr_1fr]">
        <div className="animate-rise">
          <p className="eyebrow">Access to gifts · a field terminal for the Great Turning</p>
          <h1 className="mt-5 font-display text-mega leading-[0.95] text-fg">
            The work that is <span className="text-accent">only yours</span>.
          </h1>
          <p className="mt-6 max-w-measure font-sans text-lg text-muted">
            EcoDharma reads you through several lenses and reflects back where your particular gifts
            meet what the world needs — and one small move you could make next.
          </p>
          <p className="mt-5 font-mono text-2xs uppercase tracking-eyebrow text-muted">
            <span className="text-accent">&gt;</span> comprehensive anticipatory design · online
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <Link href={user ? "/onboarding" : "/signup"} className="btn-solar" data-testid="cta-begin">
              {user ? "Compute my reading" : "Begin your reading"}
            </Link>
            <Link href="/profile" className="btn-line">open my field manual</Link>
          </div>
          <p className="mt-8 font-mono text-2xs uppercase tracking-eyebrow text-muted">
            ⊢&nbsp; {fw.domains.length} domains · {fw.gifts.length} gifts · {fw.trim_tabs.length}+ trim-tabs &nbsp;⊣
          </p>
        </div>

        <figure className="crt-frame crt-grain" data-title="Fig. 1 · whole earth · live ephemeris">
          <div className="crt-screen">
            <AsciiEarth
              fit
              speed={0.16}
              className="mx-auto phosphor-live text-[0.5rem] leading-[0.92] sm:text-[0.6rem]"
            />
          </div>
        </figure>
      </section>

      {/* THE THREE DIMENSIONS — Macy's spine, stated plainly */}
      {fw.dimensions && fw.dimensions.length > 0 && (
        <section className="mt-28">
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
