import "server-only";

// Curation/admin gate. Set ECODHARMA_ADMIN_EMAILS to a comma-separated allowlist.
// If unset, any signed-in user may curate (prototype convenience) — lock this down
// before any public deployment.
export async function isAdmin(email: string): Promise<boolean> {
  const list = (process.env.ECODHARMA_ADMIN_EMAILS || "").trim();
  if (!list) return true;
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}
