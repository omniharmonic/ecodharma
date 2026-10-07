import Link from "next/link";
import { getUser } from "@/lib/auth";
import { loadFramework } from "@/lib/framework";

// The threshold. The world is the page: an invocation floats over the night,
// and three veils say what this is — sky, surface, depths.
export default async function Home() {
  const user = await getUser();
  const fw = loadFramework();
  return (
    <div className="-mt-10">
      <section className="hero-hush flex min-h-[94vh] flex-col items-center justify-end pb-[10vh] text-center">
        <p className="whisper animate-rise">EcoDharma · a living altar for the life you are offering</p>
        <h1 className="invocation mt-6 max-w-4xl text-[2.15rem] [overflow-wrap:anywhere] leading-[1.05] sm:text-[4rem] md:text-[5.2rem] animate-rise">
          Your soul is a constellation.
          <span className="block text-[#ffd9a0]">Come see it.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-[#c9d6e8] animate-rise">
          Read the sky you were born under. Name what your life is in service to. Return to it — week by week, season by season —
          and watch who you are becoming, mirrored in still water.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3 animate-rise">
          {user ? (
            <>
              <Link href="/altar" className="dream-btn" data-testid="cta-begin">☉ Enter your altar</Link>
              <Link href="/profile" className="dream-btn-ghost">✶ Your reading</Link>
            </>
          ) : (
            <>
              <Link href="/signup" className="dream-btn" data-testid="cta-begin">✧ Begin your reading</Link>
              <Link href="/login" className="dream-btn-ghost">☽ Return</Link>
            </>
          )}
        </div>
        <p className="mt-10 whisper opacity-60">drag the heavens · pinch to approach</p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 pb-24 md:grid-cols-3">
        {[
          { g: "☉", t: "Sky", s: "What you know and offer", b: "Your natal sky and the constellation of your gifts. At the centre, a star that breathes: the prayer of your life, in your own words." },
          { g: "☽", t: "Surface", s: "Reflection", b: "Every reflection drops into the dark lake as light and ripples outward. The water remembers. Over seasons, you can read your becoming in it." },
          { g: "⟟", t: "Depths", s: "What you haven't seen yet", b: "Beneath the water, the roots you stand on — beliefs to hold, question, renew or compost. The unconscious, made walkable." },
        ].map((v) => (
          <div key={v.t} className="veil p-6">
            <div className="glyph text-3xl text-[#ffc878]">{v.g}</div>
            <p className="mt-3 font-display text-2xl text-fg">{v.t}</p>
            <p className="whisper mt-1 opacity-80">{v.s}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#c9d6e8]">{v.b}</p>
          </div>
        ))}
        <div className="veil veil-gold p-6 md:col-span-3">
          <p className="whisper">The Dharma Inquiry</p>
          <p className="mt-2 font-display text-2xl text-fg">Six chambers to find what your life is for.</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c9d6e8]">
            Values · Propensities · Capacities · Karma · Patterns · Guidance — after Daniel Schmachtenberger&apos;s
            Dharma Inquiry: dharma as <em>right relationship with Life</em>, lived in your being, your doing, and your becoming.
          </p>
          <p className="mt-4 font-mono text-2xs uppercase tracking-eyebrow text-muted">
            read through {fw.gifts.length} gifts · {fw.domains.length} world-works · western · vedic · human design · gene keys
          </p>
        </div>
      </section>
    </div>
  );
}
