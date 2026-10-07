import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { chamberOf, nextChamber, proposeFromChamber } from "@/lib/altar/inquiry";
import { getAnswers, mirror } from "@/lib/altar/inquiry-repo";
import { KIND_META } from "@/lib/altar/model";
import { MessageForm } from "@/components/MessageForm";
import { ChamberFlow } from "@/components/dream/ChamberFlow";
import { placeSeedsAction } from "../../actions/inquiry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ChamberPage({ params, searchParams }: { params: { chamber: string }; searchParams: { mirror?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const ch = chamberOf(params.chamber);
  if (!ch) notFound();
  const all = await getAnswers(user!.id);
  const mine = Object.fromEntries(ch.questions.map((q) => [q.id, all[q.id] || ""]));
  const next = nextChamber(ch.id);

  if (!searchParams.mirror) {
    return <ChamberFlow chamber={ch.id} title={ch.title} numeral={ch.numeral} glyph={ch.glyph} essence={ch.essence} questions={ch.questions.map(({ id, q, hint }) => ({ id, q, hint }))} initial={mine} />;
  }

  const reflection = await mirror(user!.id, ch.id, mine);
  const seeds = proposeFromChamber(ch.id, mine);
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center py-10" data-testid="chamber-mirror">
      <p className="whisper text-center">Chamber {ch.numeral} · {ch.title} · the mirror</p>
      <div className="veil veil-gold mt-6 p-6 md:p-8 animate-rise">
        <p className="invocation text-xl leading-relaxed md:text-2xl" data-testid="mirror-text">{reflection}</p>
      </div>
      <MessageForm action={placeSeedsAction} submitLabel={next ? `Place these · onward to ${next.title}` : "Place these · onward to the Vow"} pendingLabel="placing…" className="dream-btn mt-2">
        <input type="hidden" name="chamber" value={ch.id} />
        {seeds.length > 0 && (
          <div className="veil mt-5 p-5">
            <p className="whisper mb-3">Seeds for your altar — keep what is true</p>
            <div className="space-y-2.5">
              {seeds.map((s) => (
                <label key={s.title} className="flex cursor-pointer items-start gap-3 text-sm" data-testid="seed">
                  <input type="checkbox" name="seed" value={JSON.stringify(s)} defaultChecked className="mt-1 accent-[#e8a13a]" />
                  <span>
                    <span className="glyph mr-1 text-[#ffc878]">{KIND_META[s.kind].glyph}</span>
                    <span className="text-fg">{s.title}</span>
                    <span className="block text-2xs text-[#9fb4c8]">{KIND_META[s.kind].label}{s.mode ? ` · ${s.mode}` : ""}{s.scope ? ` · ${s.scope}` : ""} — {s.why}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </MessageForm>
      <p className="mt-4 text-center text-2xs text-[#9fb4c8]">
        <Link href={`/inquiry/${ch.id}`} className="hover:text-[#ffd9a0]">← revisit this chamber</Link> · <Link href="/inquiry" className="hover:text-[#ffd9a0]">all chambers</Link>
      </p>
    </div>
  );
}
