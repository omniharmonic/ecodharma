import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getClient, redirectAllowed } from "@/lib/oauth";
import { isPremium } from "@/lib/billing";
import { SubmitButton } from "@/components/SubmitButton";
import { decideAuthorizationAction } from "@/app/actions/oauth";

// OAuth 2.1 authorization endpoint (human-facing consent). Reuses the eco_session
// cookie for identity — no separate login for MCP clients.
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function AuthorizePage({ searchParams }: { searchParams: SP }) {
  const clientId = one(searchParams.client_id);
  const redirectUri = one(searchParams.redirect_uri);
  const responseType = one(searchParams.response_type);
  const state = one(searchParams.state);
  const scope = one(searchParams.scope);
  const resource = one(searchParams.resource);
  const codeChallenge = one(searchParams.code_challenge);
  const codeChallengeMethod = one(searchParams.code_challenge_method) || "S256";

  // A client-registration or protocol error — show it, never redirect onward.
  const client = clientId ? await getClient(clientId) : null;
  const invalid =
    one(searchParams.error) ||
    (!client && "unknown client") ||
    (client && !redirectAllowed(client, redirectUri) && "redirect_uri not registered") ||
    (responseType !== "code" && "unsupported response_type") ||
    "";
  if (invalid) return <AuthorizeError message={String(invalid)} />;

  // Identity: reuse the web session; bounce through login if absent.
  const user = await getUser();
  if (!user) {
    const back = new URL("http://x/oauth/authorize");
    Object.entries({
      response_type: "code", client_id: clientId, redirect_uri: redirectUri, state,
      scope, resource, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod,
    }).forEach(([k, v]) => v && back.searchParams.set(k, v));
    redirect(`/login?next=${encodeURIComponent(back.pathname + back.search)}`);
  }

  const premium = await isPremium(user!.id);
  const appName = client!.client_name || "An MCP client";

  return (
    <div className="mx-auto mt-24 max-w-md">
      <div className="term-window">
        <div className="term-titlebar">
          <span className="term-title">Authorize access</span>
          <span className="term-corner" aria-hidden>OAuth</span>
        </div>
        <div className="space-y-5 p-6">
          <p className="eyebrow">Connect a companion</p>
          <p className="font-display text-fig leading-snug text-fg">
            <span className="text-accent">{appName}</span> wants to reflect with your EcoDharma reading.
          </p>
          <ul className="space-y-1.5 border-y border-rule/15 py-4 font-sans text-sm text-muted">
            <li>· Read your reading — recognition, archetypes, portrait</li>
            <li>· Reflect your questions back through your own gifts</li>
            <li>· It cannot see your birth data, or change anything</li>
          </ul>
          <p className="text-2xs text-muted/70">Signed in as {user!.email}</p>

          {!premium && (
            <p className="border-l-2 border-accent pl-3 text-sm text-muted" data-testid="oauth-premium-note">
              Reflection tools are a premium companion — you can connect now, but you&rsquo;ll need
              premium to use them. <Link href="/settings" className="text-link hover:text-accent hover:underline">Manage membership</Link>.
            </p>
          )}

          <form action={decideAuthorizationAction} className="flex flex-wrap gap-3">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="resource" value={resource} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
            <SubmitButton className="btn-solar" pendingLabel="Connecting…" name="decision" value="approve">
              Authorize
            </SubmitButton>
            <SubmitButton className="btn-line" pendingLabel="…" name="decision" value="deny">
              Deny
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function AuthorizeError({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <p className="eyebrow">Authorization error</p>
      <h1 className="mt-3 font-display text-fig text-fg">This connection can&rsquo;t be completed.</h1>
      <p className="mt-3 text-sm text-muted">{message}</p>
      <Link href="/settings" className="btn-line mt-6 inline-block">Back to settings</Link>
    </div>
  );
}
