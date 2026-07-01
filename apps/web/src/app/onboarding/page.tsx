import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { OnboardingForm, type OnboardingDefaults } from "@/components/OnboardingForm";
import { createReadingAction } from "../actions/reading";

// The reading's server action calls the ephemeris + Claude (Opus ~90–120s); give
// it the full serverless budget. Fluid Compute allows up to 300s.
export const maxDuration = 300;

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // Pre-fill from any existing birth data + ikigai, so this doubles as "edit &
  // recompute" — the way someone corrects a wrong birthplace.
  const defaults = await withUser(user.id, async (c): Promise<OnboardingDefaults> => {
    const bd = (await c.query(
      "select birth_date, birth_time, unknown_time, place_label from birth_data where user_id = $1",
      [user.id],
    )).rows[0];
    const settings = (await c.query("select settings from profiles where id = $1", [user.id])).rows[0]?.settings;
    return {
      birth_date: bd?.birth_date ? new Date(bd.birth_date).toISOString().slice(0, 10) : undefined,
      birth_time: bd?.birth_time ? String(bd.birth_time).slice(0, 5) : undefined,
      unknown_time: !!bd?.unknown_time,
      place: bd?.place_label || undefined,
      ikigai: settings?.ikigai,
    };
  });
  const editing = !!defaults.birth_date;

  return (
    <div className="space-y-6 pt-8">
      <header>
        <h1 className="h-display text-fg">{editing ? "Edit your reading" : "Your reading"}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {editing
            ? "Correct anything below — your birthplace, time, or reflections — and we'll recompute the charts and reading from scratch."
            : "We'll compute your Western & Vedic charts, Human Design bodygraph, and Gene Keys sequences from open ephemeris — then interpret them through the framework, in the EcoDharma voice."}
        </p>
      </header>
      <OnboardingForm action={createReadingAction} defaults={defaults} />
    </div>
  );
}
