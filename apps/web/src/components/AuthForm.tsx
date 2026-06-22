"use client";
import { useFormState } from "react-dom";
import Link from "next/link";
import { SubmitButton } from "./SubmitButton";

type ActionState = { error?: string } | null;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AuthForm({
  action,
  mode,
}: {
  action: Action;
  mode: "login" | "signup";
}) {
  const [state, formAction] = useFormState(action, null);
  const isSignup = mode === "signup";
  return (
    <form action={formAction} className="mx-auto mt-24 max-w-md space-y-6">
      <header>
        <p className="eyebrow mb-4">{isSignup ? "New here" : "Returning"}</p>
        <h1 className="font-display text-title leading-tight text-fg">
          {isSignup ? "Begin your reading" : "Welcome back"}
        </h1>
      </header>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="at least 8 characters" />
      </div>
      {state?.error && <p className="text-sm text-flag" role="alert">{state.error}</p>}
      <SubmitButton pendingLabel={isSignup ? "Creating…" : "Signing in…"}>
        {isSignup ? "Create account" : "Sign in"}
      </SubmitButton>
      <p className="text-sm text-muted">
        {isSignup ? (
          <>Already have an account? <Link href="/login" className="text-link underline-offset-4 hover:text-accent hover:underline">Sign in</Link></>
        ) : (
          <>New here? <Link href="/signup" className="text-link underline-offset-4 hover:text-accent hover:underline">Begin</Link></>
        )}
      </p>
    </form>
  );
}
