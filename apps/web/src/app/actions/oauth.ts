"use server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getClient, redirectAllowed, createAuthCode } from "@/lib/oauth";

// The consent decision behind /oauth/authorize. Mints an authorization code and
// bounces back to the client's registered redirect URI (approve), or returns an
// access_denied error there (deny). Never redirects to an unvalidated URI.
export async function decideAuthorizationAction(formData: FormData) {
  const user = await getUser();
  const clientId = String(formData.get("client_id") || "");
  const redirectUri = String(formData.get("redirect_uri") || "");
  const state = String(formData.get("state") || "");
  const scope = String(formData.get("scope") || "") || null;
  const resource = String(formData.get("resource") || "") || null;
  const codeChallenge = String(formData.get("code_challenge") || "") || null;
  const codeChallengeMethod = String(formData.get("code_challenge_method") || "") || null;
  const decision = String(formData.get("decision") || "deny");

  if (!user) {
    // Session expired mid-consent — send them back through login, returning here.
    const back = authorizeUrl({ clientId, redirectUri, state, scope, resource, codeChallenge, codeChallengeMethod });
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  // Re-validate the client + redirect URI server-side (never trust the form alone).
  const client = await getClient(clientId);
  if (!client || !redirectAllowed(client, redirectUri)) {
    redirect(`/oauth/authorize?error=invalid_client`);
  }

  const sep = redirectUri!.includes("?") ? "&" : "?";
  if (decision !== "approve") {
    redirect(`${redirectUri}${sep}error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`);
  }

  const code = await createAuthCode({
    clientId,
    userId: user!.id,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    resource,
  });
  redirect(`${redirectUri}${sep}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`);
}

function authorizeUrl(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string | null;
  resource: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
}): string {
  const q = new URLSearchParams({ response_type: "code", client_id: p.clientId, redirect_uri: p.redirectUri });
  if (p.state) q.set("state", p.state);
  if (p.scope) q.set("scope", p.scope);
  if (p.resource) q.set("resource", p.resource);
  if (p.codeChallenge) q.set("code_challenge", p.codeChallenge);
  if (p.codeChallengeMethod) q.set("code_challenge_method", p.codeChallengeMethod);
  return `/oauth/authorize?${q.toString()}`;
}
