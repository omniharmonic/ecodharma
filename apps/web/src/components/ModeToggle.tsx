"use client";
import { useEffect, useState } from "react";

// Two printings of the same press. Persisted in localStorage (non-sensitive).
export function ModeToggle() {
  const [blueprint, setBlueprint] = useState(false);

  useEffect(() => {
    setBlueprint(document.documentElement.classList.contains("mode-blueprint"));
  }, []);

  const toggle = () => {
    const el = document.documentElement;
    const next = !el.classList.contains("mode-blueprint");
    el.classList.toggle("mode-blueprint", next);
    try {
      localStorage.setItem("eco-mode", next ? "blueprint" : "newsprint");
    } catch {}
    setBlueprint(next);
  };

  return (
    <button
      onClick={toggle}
      className="font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-accent"
      aria-label="Toggle Newsprint / Blueprint printing"
      title="Toggle printing"
    >
      <span aria-hidden>{blueprint ? "☼ newsprint" : "✦ blueprint"}</span>
    </button>
  );
}
