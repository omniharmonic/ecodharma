"use client";
import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";

type ActionState = { error?: string; ok?: string } | null;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Generic form that renders an action's ok/error message inline. */
export function MessageForm({
  action,
  submitLabel,
  pendingLabel,
  className = "btn-solar",
  children,
}: {
  action: Action;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {children}
      <SubmitButton className={className} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
      {state?.error && <p className="text-sm text-flag" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-live" role="status">{state.ok}</p>}
    </form>
  );
}
