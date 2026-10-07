import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { CHAMBERS, DHARMA_FRAME } from "@/lib/altar/inquiry";
import { chamberStatus, getAnswers } from "@/lib/altar/inquiry-repo";

export const dynamic = "force-dynamic";

// The threshold of the Inquiry: six chambers (after Schmachtenberger) arranged as portals in the dark.
export default async function InquiryPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const status = chamberStatus(await getAnswers(user!.id));
  const next = CHAMBERS.find((c) => !status.find((s) => s.id === c.id)!.answered) || null;
  const done = status.filter((s) => s.answered).length;
  return (
    <div className="flex min-h-[86vh] flex-col items-center justify-center pt-8 text-center" data-testid="inquiry-index">
      <p className="whisper">The Dharma Inquiry · {DHARMA_FRAME.credit}</p>
      <h1 className="invocation mt-5 max-w-3xl text-[2.4rem] leading-tight md:text-[3.6rem]">What is your life for?</h1>
      <p className="mx-auto mt-5 max-w-2xl text-[#c9d6e8]">
        Dharma: <em>right relationship with Life</em>. There is what is right for anyone — and what is right for <em>you</em>,
        given how you are made and what you have lived. Six chambers. One question at a time. Your answers are sealed.
      </p>
      <div className="veil mx-auto mt-6 max-w-2xl space-y-2 p-5 text-left text-sm leading-relaxed text-[#c9d6e8]" data-testid="inquiry-frame">
        <p>{DHARMA_FRAME.free}</p>
        <p>{DHARMA_FRAME.shadow}</p>
        <p>{DHARMA_FRAME.unfolding}</p>
      </div>
      <div className="relative mt-12 w-full max-w-4xl">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {CHAMBERS.map((c) => {
            const s = status.find((x) => x.id === c.id)!;
            const lit = s.answered > 0;
            return (
              <Link key={c.id} href={`/inquiry/${c.id}`} data-testid={`chamber-${c.id}`}
                className={`veil group flex flex-col items-center gap-1 px-2 py-5 transition ${lit ? "veil-gold" : ""} ${next?.id === c.id ? "ring-1 ring-[#ffc878]/60" : ""}`}>
                <span className={`glyph text-3xl transition group-hover:scale-125 ${lit ? "text-[#ffd9a0]" : "text-[#7fd3e6]"}`}>{c.glyph}</span>
                <span className="font-mono text-2xs text-[#9fb4c8]">{c.numeral}</span>
                <span className="font-display text-base text-fg">{c.title}</span>
                <span className="font-mono text-[0.6rem] text-[#9fb4c8]">{Math.min(s.answered, s.total)}/{s.total}{s.answered > s.total ? " + deeper" : ""}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {next ? (
          <Link href={`/inquiry/${next.id}`} className="dream-btn" data-testid="enter-chamber">{done ? "Continue" : "Enter"} · Chamber {next.numeral}: {next.title}</Link>
        ) : (
          <Link href="/inquiry/vow" className="dream-btn" data-testid="to-vow">☉ Write your prayer</Link>
        )}
        <Link href="/journey" className="dream-btn-ghost">⟡ The journey</Link>
        <Link href="/altar/kindle" className="dream-btn-ghost" data-testid="quick-kindle">✧ Kindle quickly instead</Link>
      </div>
      <p className="mt-8 max-w-xl text-2xs text-[#9fb4c8]">
        {DHARMA_FRAME.modes} <a href={DHARMA_FRAME.source} target="_blank" rel="noreferrer" className="underline decoration-dotted">Read Schmachtenberger&apos;s original →</a>
      </p>
    </div>
  );
}
