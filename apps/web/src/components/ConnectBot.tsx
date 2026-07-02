"use client";
import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";
import { createBotLinkAction } from "@/app/actions/bot";

// Premium: generate a one-time code, then connect Telegram either by tapping the
// deep link (if the bot username is configured) or by sending the code to the bot.
export function ConnectBot() {
  const [state, act] = useFormState(createBotLinkAction, null);

  return (
    <div>
      <p className="eyebrow mb-2">Reflect via Telegram</p>
      <p className="mb-3 max-w-prose text-sm text-muted">
        Talk with your profile any time. Generate a one-time code, then send it to the EcoDharma bot
        (or tap the link) to connect this account.
      </p>
      <form action={act}>
        <SubmitButton className="btn-line" pendingLabel="Generating…">Connect Telegram</SubmitButton>
      </form>
      {state?.error && <p className="mt-2 text-sm text-flag" role="alert">{state.error}</p>}
      {state?.code && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">Your one-time code (valid 30 min):</p>
          <code data-testid="bot-code" className="inline-block border border-rule/30 px-3 py-1.5 font-mono text-sm text-fg">
            {state.code}
          </code>
          {state.link && (
            <p>
              <a href={state.link} className="btn-solar mt-1 inline-block" target="_blank" rel="noreferrer">
                Open in Telegram →
              </a>
            </p>
          )}
          <p className="text-xs text-muted/80">
            Send <span className="font-mono">/start {state.code}</span> to the bot to connect.
          </p>
        </div>
      )}
    </div>
  );
}
