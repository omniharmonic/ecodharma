import type { ConstellationRead } from "@/lib/types";

// The Human Design relational substrate beneath the gift read. Computed
// structurally (electromagnetics, conditioning, penta roles, composite type),
// it shows the mechanics of *why* a constellation hums or grinds — the gifts
// stay the headline; this is the engine room under the floor.

const KIND_META: Record<
  "electromagnetic" | "companionship" | "compromise" | "dominance",
  { label: string; gloss: string }
> = {
  electromagnetic: { label: "Electromagnetic", gloss: "each holds one half — together you complete the channel; the spark, and the friction that rides with it" },
  companionship: { label: "Companionship", gloss: "you both carry the whole channel — easy, shared common ground" },
  compromise: { label: "Compromise", gloss: "one holds the full channel, the other a single gate — workable, with give and take" },
  dominance: { label: "Dominance", gloss: "one holds the full channel, the other nothing — energy flows one way, conditioning the open one" },
};

export function ConstellationRelational({
  relational,
}: {
  relational: ConstellationRead["relational"];
}) {
  if (!relational?.group) return null;
  const { group, pair } = relational;

  return (
    <section className="mt-16 border-t border-rule/15 pt-10" data-testid="relational-substrate">
      <p className="eyebrow mb-2">Beneath the read · Human Design mechanics</p>
      <p className="mb-8 max-w-prose text-sm text-muted">
        The structural layer under the gifts — how these bodygraphs actually meet. Read it as the
        engine room, not the headline.
      </p>

      {/* Composite / group type */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Stat k="Group type" v={group.groupType} />
        <Stat k="Functions as" v={group.groupCareerType} />
        <Stat k="Group channels" v={String(group.stats.totalChannels)} />
        <Stat k="Electromagnetics" v={String(group.stats.electromagneticCount)} />
      </div>

      {/* Penta roles */}
      <div className="mt-10">
        <p className="eyebrow mb-4">Roles in the field {group.isPenta ? "· a full penta" : ""}</p>
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <div>
            <p className="kv mb-3 text-live">Held</p>
            <ul className="divide-y divide-rule/12" data-testid="penta-filled">
              {group.filledRoles.map((r) => (
                <li key={r.center} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-sans text-fg">{r.role}</span>
                    <span className="pill">{r.contributors.join(", ")}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="kv mb-3 text-flag">Open in the group</p>
            {group.missingRoles.length === 0 ? (
              <p className="py-3 text-sm text-muted">Every centre-role is held — a rare, whole field.</p>
            ) : (
              <ul className="divide-y divide-rule/12" data-testid="penta-missing">
                {group.missingRoles.map((r) => (
                  <li key={r.center} className="py-3">
                    <span className="font-sans text-fg">{r.role}</span>
                    <p className="mt-1 text-sm text-muted">{r.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Pair: the four connection types + conditioning */}
      {pair && (
        <div className="mt-12">
          <p className="eyebrow mb-1">How {pair.nameA} &amp; {pair.nameB} meet</p>
          <p className="mb-5 max-w-prose text-sm text-muted">
            {pair.typeInteraction.typeA} + {pair.typeInteraction.typeB} — {pair.typeInteraction.dynamic.toLowerCase()}.
            Composite type: <span className="text-fg">{pair.compositeType}</span>.
          </p>
          <div className="space-y-6">
            {(["electromagnetic", "companionship", "compromise", "dominance"] as const).map((kind) => {
              const items = pair.connections[kind];
              if (!items.length) return null;
              const meta = KIND_META[kind];
              return (
                <div key={kind}>
                  <p className="kv mb-2">
                    {meta.label} <span className="text-muted">· {meta.gloss}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((c, i) => (
                      <span key={i} className="pill" title={c.description}>
                        {c.channel} · {c.theme}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Group electromagnetics (3+ members) */}
      {!pair && group.electromagnetics.length > 0 && (
        <div className="mt-12">
          <p className="eyebrow mb-3">Electromagnetic threads</p>
          <ul className="divide-y divide-rule/12">
            {group.electromagnetics.slice(0, 12).map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
                <span className="text-fg">{e.personA} <span className="text-accent">+</span> {e.personB}</span>
                <span className="kv">{e.channel} · {e.theme}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {group.recommendations.length > 0 && (
        <div className="mt-12 border-l-2 border-accent pl-5">
          <p className="eyebrow mb-3">What the mechanics suggest</p>
          <div className="space-y-4">
            {group.recommendations.map((r, i) => (
              <div key={i}>
                <p className="kv text-accent">{r.category}</p>
                <p className="mt-1 text-fg">{r.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="kv">{k}</p>
      <p className="mt-1 font-display text-lg text-fg">{v}</p>
    </div>
  );
}
