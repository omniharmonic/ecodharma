"use client";
import { usePathname } from "next/navigation";

// The live shell prompt: eco@dharma:~/<route>$ ▊  — reflects the current path.
export function RoutePrompt({ caret = true }: { caret?: boolean }) {
  const path = usePathname() || "/";
  const tail = path === "/" ? "~" : `~${path}`;
  return (
    <span className="term-prompt whitespace-nowrap" aria-hidden>
      <span className="term-prompt-user">eco@dharma</span>
      <span className="text-muted">:</span>
      <span className="term-prompt-path">{tail}</span>
      <span className="term-prompt-sigil">$</span>
      {caret && <span className="caret" />}
    </span>
  );
}
