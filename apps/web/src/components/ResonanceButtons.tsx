"use client";
import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";
import { resonateTrimTabAction } from "@/app/actions/trimtab";

// Resonance feedback on a trim-tab. Feeds curation (which generated trim-tabs land)
// and the PRD's resonance success metric.
export function ResonanceButtons({ trimTabId }: { trimTabId?: number }) {
  const [state, formAction] = useFormState(resonateTrimTabAction, null);
  if (!trimTabId) return null;
  if (state?.ok) return <p className="text-xs text-live" role="status">{state.ok}</p>;
  return (
    <div className="mt-3 flex items-center gap-3 font-mono text-2xs uppercase tracking-eyebrow">
      <span className="text-muted/60">Does this resonate?</span>
      <form action={formAction}>
        <input type="hidden" name="trim_tab_id" value={trimTabId} />
        <input type="hidden" name="dir" value="up" />
        <SubmitButton className="border border-live/40 px-3 py-1 text-live hover:bg-live/10" pendingLabel="…">
          [ yes ]
        </SubmitButton>
      </form>
      <form action={formAction}>
        <input type="hidden" name="trim_tab_id" value={trimTabId} />
        <input type="hidden" name="dir" value="down" />
        <SubmitButton className="border border-flag/40 px-3 py-1 text-flag hover:bg-flag/10" pendingLabel="…">
          [ not quite ]
        </SubmitButton>
      </form>
    </div>
  );
}
