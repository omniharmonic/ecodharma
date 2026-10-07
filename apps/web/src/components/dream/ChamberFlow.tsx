"use client";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveChamberAction } from "@/app/actions/inquiry";
import { dream } from "./bus";

type Q = { id: string; q: string; hint?: string };

/** One question at a time, in the dark, close to the star. */
export function ChamberFlow({ chamber, title, numeral, glyph, essence, questions, initial }: {
  chamber: string; title: string; numeral: string; glyph: string; essence: string; questions: Q[]; initial: Record<string, string>;
}) {
  const [state, action] = useFormState(saveChamberAction, null);
  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, string>>(initial);
  useEffect(() => { dream({ type: "ripple", strength: 0.6 }); }, [i]);
  const q = questions[i];
  const last = i === questions.length - 1;
  return (
    <form action={action} className="mx-auto flex min-h-[78vh] max-w-2xl flex-col justify-center" data-testid="chamber-flow">
      <input type="hidden" name="chamber" value={chamber} />
      {questions.map((x) => <input key={x.id} type="hidden" name={x.id} value={vals[x.id] || ""} />)}
      <p className="whisper text-center">Chamber {numeral} · {title} <span className="glyph">{glyph}</span></p>
      <p className="mx-auto mt-2 max-w-md text-center text-2xs text-[#9fb4c8]">{essence}</p>
      <div key={q.id} className="veil mt-8 p-6 animate-rise md:p-8">
        <label htmlFor={`f-${q.id}`} className="invocation block text-[1.6rem] leading-snug md:text-[2rem]">{q.q}</label>
        {q.hint && <p className="mt-2 text-2xs text-[#9fb4c8]">{q.hint}</p>}
        <textarea
          id={`f-${q.id}`} rows={4} autoFocus value={vals[q.id] || ""} data-testid={`q-${q.id}`}
          onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))}
          className="input mt-5 text-base leading-relaxed" placeholder="Write freely. Lists are fine. Silence is fine."
        />
        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label="progress">
            {questions.map((x, k) => (
              <span key={x.id} className={`h-1.5 w-6 ${k === i ? "bg-[#ffc878]" : (vals[x.id] || "").trim() ? "bg-[#ffc878]/40" : "bg-white/10"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button type="button" className="dream-btn-ghost !px-3 !py-2" onClick={() => setI(i - 1)}>← back</button>}
            {!last && <button type="button" className="dream-btn !px-4 !py-2" onClick={() => setI(i + 1)} data-testid="next-question">next →</button>}
            {last && <SubmitButton className="dream-btn !px-4 !py-2" pendingLabel="listening…">close the chamber</SubmitButton>}
          </div>
        </div>
      </div>
      {state?.error && <p className="mt-3 text-center text-sm text-flag" role="alert">{state.error}</p>}
    </form>
  );
}
