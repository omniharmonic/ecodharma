"use client";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { ensureShareLinkAction, disableShareLinkAction } from "@/app/actions/share";

// The "Share your reading" surface on /profile. Opt-in: nothing public exists
// until the user mints a link. Shows a live preview + copy + download + disable.
export function ShareCard({ token }: { token: string | null }) {
  const [ensureState, ensure] = useFormState(ensureShareLinkAction, null);
  const [disableState, disable] = useFormState(disableShareLinkAction, null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // Resolve the origin on the client so the link is correct in dev, e2e, and prod.
  useEffect(() => setOrigin(window.location.origin), []);

  const shareUrl = token ? `${origin}/r/${token}` : "";
  const img = (size: string) => `/api/og/${token}?size=${size}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl || `${window.location.origin}/r/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the field below is selectable as a fallback */
    }
  }

  return (
    <div>
      <p className="eyebrow mb-3">Share your reading</p>

      {!token ? (
        <form action={ensure} className="space-y-3">
          <p className="max-w-prose text-sm text-muted">
            Create a public link with a downloadable card — your opening reflection and archetypes only,
            nothing else — to invite others to discover their own gifts.
          </p>
          <SubmitButton className="btn-line" pendingLabel="Creating…">Create a share card</SubmitButton>
          {ensureState?.error && <p className="text-sm text-flag" role="alert">{ensureState.error}</p>}
        </form>
      ) : (
        <div className="space-y-5">
          {/* live preview of the downloadable (square) card */}
          <div className="max-w-md overflow-hidden border border-rule/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img("square")} alt="Your shareable reading card" width={1080} height={1080} className="h-auto w-full" />
          </div>

          {/* copyable link */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="input min-w-0 flex-1 font-mono text-sm"
              aria-label="Public share link"
            />
            <button type="button" onClick={copy} className="btn-line whitespace-nowrap">
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>

          {/* downloads for different social surfaces */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="kv">Download:</span>
            <a href={img("square")} download="ecodharma-card-square.png" className="btn-line">Square (post)</a>
            <a href={img("story")} download="ecodharma-card-story.png" className="btn-line">Story (9:16)</a>
            <a href={img("og")} download="ecodharma-card-wide.png" className="btn-line">Wide (link)</a>
          </div>

          <form action={disable}>
            <SubmitButton className="btn-line" pendingLabel="Turning off…">Disable link</SubmitButton>
            {disableState?.error && <p className="mt-2 text-sm text-flag" role="alert">{disableState.error}</p>}
          </form>
          <p className="text-xs text-muted/80">
            Anyone with the link sees only your opening reflection and archetypes. Disable it anytime.
          </p>
        </div>
      )}
    </div>
  );
}
