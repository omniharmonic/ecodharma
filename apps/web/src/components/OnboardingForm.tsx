"use client";
import { useFormState } from "react-dom";
import { useState, useEffect } from "react";
import { SubmitButton } from "./SubmitButton";
import { ComputeOverlay } from "./ComputeOverlay";

type ActionState = { error?: string } | null;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function OnboardingForm({ action, cities }: { action: Action; cities: string[] }) {
  const [state, formAction] = useFormState(action, null);
  const [unknownTime, setUnknownTime] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // On validation error the action returns (no navigation) — drop the overlay.
  useEffect(() => {
    if (state?.error) setSubmitting(false);
  }, [state]);

  return (
    <form action={formAction} onSubmit={() => setSubmitting(true)} className="max-w-measure">
      <ComputeOverlay show={submitting} />
      <section className="space-y-4">
        <div>
          <p className="eyebrow mb-2">Step one</p>
          <h2 className="font-display text-fig text-fg">Where &amp; when you arrived</h2>
        </div>
        <p className="text-sm text-muted">
          Birth date, time, and place. Time is sensitive — it shapes your rising sign, houses, and
          (especially) Human Design. If you don&rsquo;t know it, that&rsquo;s okay; we&rsquo;ll flag
          what becomes uncertain.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="birth_date">Birth date</label>
            <input id="birth_date" name="birth_date" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="birth_time">Birth time</label>
            <input
              id="birth_time" name="birth_time" type="time"
              className="input" disabled={unknownTime}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox" name="unknown_time" value="true"
                checked={unknownTime} onChange={(e) => setUnknownTime(e.target.checked)}
              />
              I don&rsquo;t know my birth time
            </label>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="place">Birth place</label>
          <input id="place" name="place" list="cities" className="input" placeholder="Any city, anywhere — e.g. Reykjavík" />
          <datalist id="cities">
            {cities.map((c) => <option key={c} value={c} />)}
          </datalist>
          <p className="mt-1 text-xs text-muted/60">
            Any city on Earth resolves to coordinates &amp; timezone. Or enter exact coordinates below.
          </p>
        </div>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">Advanced: exact coordinates</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input name="lat" type="number" step="any" className="input" placeholder="latitude" />
            <input name="lng" type="number" step="any" className="input" placeholder="longitude" />
            <input name="tz_str" className="input" placeholder="IANA tz e.g. Europe/Berlin" />
          </div>
        </details>
      </section>

      <section className="mt-16 space-y-4 border-t border-rule/15 pt-8">
        <div>
          <p className="eyebrow mb-2">Step two</p>
          <h2 className="font-display text-fig text-fg">Your Ikigai reflection</h2>
        </div>
        <p className="text-sm text-muted">
          Four honest sentences. These keep the reading grounded in your own voice.
        </p>
        <div className="grid gap-4">
          <Field name="love" label="What do you love? What makes you feel alive?" />
          <Field name="skill" label="What are you genuinely good at?" />
          <Field name="world_need" label="What does the world (your place, now) most need?" />
          <Field name="livelihood" label="What could sustain you materially?" />
        </div>
      </section>

      <div className="mt-12 space-y-4 border-t border-rule/15 pt-8">
        {state?.error && <p className="text-sm text-flag" role="alert">{state.error}</p>}
        <SubmitButton pendingLabel="Computing your charts & weaving your profile…">
          Reveal my gift profile
        </SubmitButton>
      </div>
    </form>
  );
}

function Field({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea id={name} name={name} required rows={2} className="input" />
    </div>
  );
}
