"use client";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { createInviteLinkAction } from "@/app/actions/constellation";

// Owner control: mint a shareable join link (optionally capped by uses).
export function InviteLink({ constellationId }: { constellationId: number }) {
  const [state, act] = useFormState(createInviteLinkAction, null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const link = state?.token ? `${origin}/invite/${state.token}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the field is selectable as a fallback */
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Prefer a link? Generate one to share directly — set how many people may use it.
      </p>
      <form action={act} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Max uses (blank = unlimited)</span>
          <input name="max_uses" type="number" min={1} max={100} inputMode="numeric" className="input w-40" placeholder="e.g. 5" />
        </label>
        <input type="hidden" name="constellation_id" value={constellationId} />
        <SubmitButton className="btn-line" pendingLabel="Creating…">Create join link</SubmitButton>
      </form>
      {state?.error && <p className="mt-2 text-sm text-flag" role="alert">{state.error}</p>}
      {state?.token && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="input min-w-0 flex-1 font-mono text-sm"
            aria-label="Constellation join link"
            data-testid="invite-link"
          />
          <button type="button" onClick={copy} className="btn-line whitespace-nowrap">
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
