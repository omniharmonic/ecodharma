import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { CITIES } from "@/lib/places";
import { OnboardingForm } from "@/components/OnboardingForm";
import { createReadingAction } from "../actions/reading";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="space-y-6 pt-8">
      <header>
        <h1 className="h-display text-fg">Your reading</h1>
        <p className="mt-2 max-w-2xl text-muted">
          We&rsquo;ll compute your Western & Vedic charts, Human Design bodygraph, and Gene Keys
          sequences from open ephemeris — then interpret them through the framework, in the EcoDharma
          voice.
        </p>
      </header>
      <OnboardingForm action={createReadingAction} cities={Object.keys(CITIES)} />
    </div>
  );
}
