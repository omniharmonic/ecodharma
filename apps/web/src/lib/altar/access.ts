import "server-only";
import { isPremium } from "../billing";

// Who may keep a Living Altar. For the friends-and-family phase: anyone with
// premium (Benjamin comps friends via /curate → "Grant premium"), or everyone
// when ALTAR_ACCESS=open (local dev / e2e / a later public launch).
export async function canUseAltar(userId: string): Promise<boolean> {
  if ((process.env.ALTAR_ACCESS || "invite") === "open") return true;
  return isPremium(userId);
}
