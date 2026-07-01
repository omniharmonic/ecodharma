"use client";
import { useEffect, useRef, useState } from "react";

type Place = { lat: number; lng: number; tz: string; label?: string };

// Birthplace autocomplete: as you type, it queries /api/geocode and lists precise
// matches. Picking one stores its exact lat/lng/tz in hidden inputs — so an
// ambiguous name ("Salem") can never silently resolve to the wrong city. If you
// don't pick (offline, obscure place), the server still geocodes the typed text.
export function PlaceField({ defaultValue = "" }: { defaultValue?: string }) {
  const [q, setQ] = useState(defaultValue);
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onChange(v: string) {
    setQ(v);
    setPicked(null); // typing invalidates a prior selection → server will geocode the text
    setActive(0);
    clearTimeout(debounce.current);
    if (v.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(v)}`);
        const j = await r.json();
        setResults(j.places || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 220);
  }

  function choose(p: Place) {
    setPicked(p);
    setQ(p.label || "");
    setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        id="place"
        name="place"
        className="input"
        placeholder="Start typing a city — e.g. Salem"
        autoComplete="off"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="place-listbox"
        data-testid="place-input"
      />
      {/* precise coords for the picked city — the reading action prefers these */}
      <input type="hidden" name="place_lat" value={picked?.lat ?? ""} />
      <input type="hidden" name="place_lng" value={picked?.lng ?? ""} />
      <input type="hidden" name="place_tz" value={picked?.tz ?? ""} />

      {picked ? (
        <p className="mt-1 text-2xs text-live" data-testid="place-confirmed">
          ✓ {picked.label} · {picked.tz}
        </p>
      ) : (
        <p className="mt-1 text-2xs text-muted/70">
          Pick your city from the list so the timezone &amp; coordinates are exact.
        </p>
      )}

      {open && results.length > 0 && (
        <ul
          id="place-listbox"
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto border border-rule/30 bg-bg shadow-lg"
        >
          {results.map((p, i) => (
            <li key={`${p.lat},${p.lng}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left font-sans text-sm ${i === active ? "bg-accent/15 text-fg" : "text-muted"}`}
                data-testid="place-option"
              >
                <span>{p.label}</span>
                <span className="font-mono text-2xs text-muted/70">{p.tz}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && q.trim().length >= 2 && (
        <p className="absolute z-40 mt-1 w-full border border-rule/30 bg-bg px-3 py-2 text-sm text-muted">
          No match — type a bit more, or add exact coordinates below.
        </p>
      )}
    </div>
  );
}
