"use client";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { issueMcpTokenAction, revokeMcpTokenAction } from "@/app/actions/mcp";

// Premium: issue a bearer token to reflect via any MCP client (Claude, etc.).
export function McpPanel({ hasToken }: { hasToken: boolean }) {
  const [issued, issue] = useFormState(issueMcpTokenAction, null);
  const [revoked, revoke] = useFormState(revokeMcpTokenAction, null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const endpoint = origin ? `${origin}/api/mcp` : "/api/mcp";

  return (
    <div>
      <p className="eyebrow mb-2">Reflect via your own AI tool (MCP)</p>
      <p className="mb-3 max-w-prose text-sm text-muted">
        Connect any MCP-capable client to reflect with your reading. Add the endpoint below as a
        custom connector — <strong className="text-fg">Claude Desktop &amp; claude.ai sign you in
        automatically</strong> (you&rsquo;ll see a one-tap authorize screen). No token to copy.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="kv">endpoint:</span>
        <code className="border border-rule/30 px-2 py-1 font-mono text-xs text-fg">{endpoint}</code>
      </div>
      <ol className="mb-3 max-w-prose list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>In Claude (or another client), add a <span className="text-fg">custom connector</span> and paste the endpoint above.</li>
        <li>Approve the one-tap sign-in screen when it appears.</li>
        <li>Then ask it to <span className="font-mono">reflect</span> — e.g. <span className="text-fg">“Reflect with my EcoDharma reading: where should I put my energy this week?”</span> or <span className="text-fg">“Using my constellations, how do I relate to Maya?”</span></li>
      </ol>
      <details className="mb-3 max-w-prose text-sm text-muted">
        <summary className="cursor-pointer font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-accent">
          Using a client without sign-in? Issue a bearer token
        </summary>
        <p className="mt-2 text-sm text-muted">
          Some MCP clients let you paste a static token instead of signing in. Generate one below and
          use it as a <code className="text-fg">Bearer</code> credential.
        </p>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <form action={issue}>
          <SubmitButton className="btn-line" pendingLabel="Generating…">
            {hasToken || issued?.token ? "Regenerate token" : "Generate MCP token"}
          </SubmitButton>
        </form>
        {(hasToken || issued?.token) && (
          <form action={revoke}>
            <SubmitButton className="btn-line" pendingLabel="Revoking…">Revoke</SubmitButton>
          </form>
        )}
      </div>
      {issued?.error && <p className="mt-2 text-sm text-flag" role="alert">{issued.error}</p>}
      {revoked?.ok && <p className="mt-2 text-sm text-live" role="status">{revoked.ok}</p>}
      {issued?.token && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">Your token (shown once — copy it now):</p>
          <code data-testid="mcp-token" className="block break-all border border-rule/30 px-3 py-2 font-mono text-xs text-fg">
            {issued.token}
          </code>
        </div>
      )}
    </div>
  );
}
