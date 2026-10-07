import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { journey } from "@/lib/altar/inquiry-repo";
import { MODE_META, MODES, modeOf, altarElements } from "@/lib/altar/model";

export const dynamic = "force-dynamic";

// The Dharma Journey: seven stages from inquiry to witness, a path of light.
export default async function JourneyPage({ searchParams }: { searchParams: { vowed?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const j = await journey(user!.id);
  const els = altarElements(j.altar);
  const byMode = Object.fromEntries(MODES.map((m) => [m, els.filter((e) => modeOf(e) === m)]));
  return (
    <div className="mx-auto max-w-4xl py-8" data-testid="journey">
      <div className="text-center">
        <p className="whisper">The Dharma Journey</p>
        <h1 className="invocation mt-4 text-[2.4rem] leading-tight md:text-[3.4rem]">From inquiry to practice.</h1>
        <p className="mx-auto mt-4 max-w-xl text-[#c9d6e8]">Seven stages, about one a week. Then the ritual calendar carries you — season after season.</p>
        {searchParams.vowed && <p className="veil veil-gold mx-auto mt-6 max-w-md p-3 text-sm text-fg" data-testid="vowed">☉ Your prayer is vowed. The altar is lit.</p>}
      </div>

      <ol className="relative mt-12 space-y-3 before:absolute before:bottom-6 before:left-[1.6rem] before:top-6 before:w-px before:bg-gradient-to-b before:from-[#ffc878]/70 before:to-[#7fd3e6]/20">
        {j.stages.map((s) => {
          const current = j.current?.id === s.id;
          return (
            <li key={s.id} className="relative pl-16" data-testid={`stage-${s.id}`} data-done={s.done ? "yes" : "no"}>
              <span className={`absolute left-0 top-3 grid h-[3.2rem] w-[3.2rem] place-items-center rounded-full border text-xl glyph ${s.done ? "border-[#ffc878] bg-[#ffc878]/15 text-[#ffd9a0] shadow-[0_0_24px_rgba(255,200,120,0.45)]" : current ? "border-[#7fd3e6] text-[#7fd3e6] altar-breathe" : "border-white/15 text-white/40"}`}>{s.glyph}</span>
              <Link href={s.href} className={`veil block p-4 transition hover:border-[#ffc878]/50 ${current ? "veil-gold" : ""}`}>
                <p className="font-mono text-2xs uppercase tracking-eyebrow text-[#9fb4c8]">{s.numeral} · {s.done ? "complete" : current ? "you are here" : "ahead"}</p>
                <p className="font-display text-xl text-fg">{s.title}</p>
                <p className="text-sm text-[#c9d6e8]">{s.essence}</p>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 grid gap-3 md:grid-cols-3" data-testid="modes">
        {MODES.map((m) => (
          <div key={m} className="veil p-4">
            <p className="whisper">{MODE_META[m].glyph} {MODE_META[m].label}</p>
            <p className="mt-1 text-2xs text-[#9fb4c8]">{MODE_META[m].meaning}</p>
            <ul className="mt-3 space-y-1 text-sm text-fg">
              {byMode[m].slice(0, 6).map((e) => <li key={e.id}>· {e.title}</li>)}
              {byMode[m].length === 0 && <li className="text-[#9fb4c8]">— nothing yet</li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-2xs text-[#9fb4c8]">Being · Doing · Becoming — after Daniel Schmachtenberger&apos;s Dharma Inquiry.</p>
    </div>
  );
}
