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
        Connect any MCP-capable client (Claude and others) to reflect with your reading. Point it at
        the endpoint below and use your token as a bearer credential.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="kv">endpoint:</span>
        <code className="border border-rule/30 px-2 py-1 font-mono text-xs text-fg">{endpoint}</code>
      </div>
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
