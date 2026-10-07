"use client";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveChamberAction } from "@/app/actions/inquiry";
import { WHY, composeLayers } from "@/lib/altar/inquiry";
import { dream } from "./bus";

type Q = { id: string; q: string; hint?: string; deep?: boolean };

const split = (s: string | undefined) => {
  const l = (s || "").split(WHY);
  return l.length ? l : [""];
};

/** One question at a time, in the dark, close to the star. Core first; deeper if they choose; "why?" where the chamber invites it. */
export function ChamberFlow({ chamber, title, numeral, glyph, essence, questions, initial, ladder }: {
  chamber: string; title: string; numeral: string; glyph: string; essence: string; questions: Q[]; initial: Record<string, string>; ladder?: boolean;
}) {
  const [state, action] = useFormState(saveChamberAction, null);
  const core = questions.filter((q) => !q.deep);
  const deep = questions.filter((q) => q.deep);
  const [deeper, setDeeper] = useState(() => deep.some((q) => (initial[q.id] || "").trim()));
  const shown = deeper ? [...core, ...deep] : core;
  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, string[]>>(() => Object.fromEntries(questions.map((q) => [q.id, split(initial[q.id])])));
  useEffect(() => { dream({ type: "ripple", strength: 0.6 }); }, [i]);
  const q = shown[Math.min(i, shown.length - 1)];
  const last = i >= shown.length - 1;
  const ls = vals[q.id] || [""];
  const set = (k: number, v: string) => setVals((all) => { const n = [...(all[q.id] || [""])]; n[k] = v; return { ...all, [q.id]: n }; });
  const canWhy = ladder && (ls[ls.length - 1] || "").trim().length > 0 && ls.length < 6;

  return (
    <form action={action} className="mx-auto flex min-h-[78vh] max-w-2xl flex-col justify-center" data-testid="chamber-flow">
      <input type="hidden" name="chamber" value={chamber} />
      {questions.map((x) => <input key={x.id} type="hidden" name={x.id} value={composeLayers(vals[x.id] || [""])} />)}
      <div className="chamber-head mx-auto max-w-md px-5 py-3">
        <p className="whisper text-center">Chamber {numeral} · {title} <span className="glyph">{glyph}</span></p>
        <p className="mx-auto mt-1.5 text-center text-2xs text-[#d6e0ee]">{essence}</p>
      </div>
      <div key={q.id} className="veil mt-8 p-6 animate-rise md:p-8">
        {q.deep && <p className="whisper mb-2 opacity-70">deeper</p>}
        <label htmlFor={`f-${q.id}`} className="invocation block text-[1.6rem] leading-snug md:text-[2rem]">{q.q}</label>
        {q.hint && <p className="mt-2 text-2xs text-[#9fb4c8]">{q.hint}</p>}
        <textarea
          id={`f-${q.id}`} rows={4} autoFocus value={ls[0] || ""} data-testid={`q-${q.id}`}
          onChange={(e) => set(0, e.target.value)}
          className="input mt-5 text-base leading-relaxed" placeholder="Write freely. Lists are fine. Silence is fine."
        />
        {ls.slice(1).map((w, k) => (
          <div key={k} className="mt-3 pl-4" style={{ marginLeft: `${Math.min(k, 4) * 0.75}rem`, borderLeft: "1px solid rgba(255,200,120,.35)" }}>
            <label htmlFor={`w-${q.id}-${k}`} className="whisper block opacity-80">↳ and why{k ? ", beneath that" : ""}?</label>
            <textarea id={`w-${q.id}-${k}`} rows={2} autoFocus value={w} data-testid="why-input"
              onChange={(e) => set(k + 1, e.target.value)} className="input mt-1.5 text-base leading-relaxed" />
          </div>
        ))}
        {canWhy && (
          <button type="button" className="mt-3 text-2xs uppercase tracking-eyebrow text-[#ffd9a0] hover:text-white" data-testid="ask-why"
            onClick={() => setVals((all) => ({ ...all, [q.id]: [...(all[q.id] || [""]), ""] }))}>
            ↳ and why?
          </button>
        )}
        {ladder && ls.length === 1 && i === 0 && (
          <p className="mt-2 text-2xs text-[#9fb4c8]">In this chamber, ask “why?” of your answer — and again — until you reach something that feels fundamental.</p>
        )}
        <div className="mt-5 flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5" aria-label="progress">
            {shown.map((x, k) => (
              <span key={x.id} className={`h-1.5 w-6 ${k === i ? "bg-[#ffc878]" : (vals[x.id]?.[0] || "").trim() ? "bg-[#ffc878]/40" : "bg-white/10"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button type="button" className="dream-btn-ghost !px-3 !py-2" onClick={() => setI(i - 1)}>← back</button>}
            {!last && <button type="button" className="dream-btn !px-4 !py-2" onClick={() => setI(i + 1)} data-testid="next-question">next →</button>}
            {last && <SubmitButton className="dream-btn !px-4 !py-2" pendingLabel="listening…">close the chamber</SubmitButton>}
          </div>
        </div>
        {last && !deeper && deep.length > 0 && (
          <p className="mt-4 text-right text-2xs text-[#9fb4c8]">
            or{" "}
            <button type="button" className="uppercase tracking-eyebrow text-[#ffd9a0] hover:text-white" data-testid="go-deeper" onClick={() => { setDeeper(true); setI(core.length); }}>
              go deeper · {deep.length} more
            </button>
          </p>
        )}
      </div>
      {state?.error && <p className="mt-3 text-center text-sm text-flag" role="alert">{state.error}</p>}
    </form>
  );
}
