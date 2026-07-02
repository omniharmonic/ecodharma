"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "btn-solar",
  pendingLabel,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  // Optional — lets one form carry multiple submit buttons (e.g. approve/deny),
  // sending which button was clicked as a form field.
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel || "Working…" : children}
    </button>
  );
}
