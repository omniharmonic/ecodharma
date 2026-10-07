import { constellationDharma, DHARMA_ROLES, ROLE_META } from "@/lib/altar/constellations";
import { MessageForm } from "@/components/MessageForm";
import { revokeOfferingAction, setRoleAction, sharedPrayerAction, witnessAction } from "@/app/actions/dharma";

/** The Dharma layer of a constellation: roles, shared prayer, offerings, witness. */
export async function DharmaSection({ userId, cid }: { userId: string; cid: number }) {
  const d = await constellationDharma(userId, cid);
  const me = d.members.find((m) => m.me);
  if (!me?.consented) return null;
  const prayer = d.prayerRings[d.prayerRings.length - 1];
  return (
    <section className="mt-16 console p-6" data-testid="dharma-section">
      <p className="telemetry text-accent">✶ Dharma Constellation · co-arising</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Shared prayer {prayer ? `· ring ${prayer.version}` : ""}</p>
          {prayer ? (
            <p className="illuminated mt-2 font-display text-lg leading-snug text-fg" data-testid="shared-prayer">{prayer.title}</p>
          ) : (
            <p className="mt-2 text-2xs text-muted">No shared prayer yet. What is this constellation in service to, together?</p>
          )}
          <MessageForm action={sharedPrayerAction} submitLabel={prayer ? "Add a new ring" : "Write the shared prayer"} className="btn-line text-2xs">
            <input type="hidden" name="constellation_id" value={cid} />
            <input type="hidden" name="kind" value="prayer" />
            <textarea name="title" rows={2} className="input font-display" defaultValue={prayer?.title || ""} placeholder="May we…" />
          </MessageForm>
          {d.works.length > 0 && (
            <ul className="mt-3 text-sm text-fg">{d.works.map((w) => <li key={w.id}>◈ {w.title}</li>)}</ul>
          )}
          <MessageForm action={sharedPrayerAction} submitLabel="Add a shared work" className="btn-line text-2xs">
            <input type="hidden" name="constellation_id" value={cid} />
            <input type="hidden" name="kind" value="work" />
            <input name="title" className="input" placeholder="a work we carry together" />
          </MessageForm>
        </div>

        <div>
          <p className="eyebrow">Roles</p>
          <ul className="mt-2 space-y-1 text-sm">
            {d.members.filter((m) => m.consented).map((m) => (
              <li key={m.id} className="text-fg">
                <span className="glyph text-accent">{ROLE_META[m.role].glyph}</span> {m.name}{m.me ? " (you)" : ""} · <span className="telemetry">{m.role}</span>
              </li>
            ))}
          </ul>
          <MessageForm action={setRoleAction} submitLabel="Set my role" className="btn-line text-2xs">
            <input type="hidden" name="constellation_id" value={cid} />
            <select name="role" defaultValue={me.role} className="input" data-testid="my-role">
              {DHARMA_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].glyph} {r} — {ROLE_META[r].meaning}</option>)}
            </select>
          </MessageForm>
        </div>
      </div>

      <div className="mt-8">
        <p className="eyebrow">Offerings — reflections members chose to share</p>
        {d.offerings.length === 0 && <p className="mt-2 text-2xs text-muted">Nothing offered yet. Offer a reflection from your journal.</p>}
        <ul className="mt-3 space-y-4">
          {d.offerings.map((o) => (
            <li key={o.id} className="border-l-2 border-accent/50 pl-3" data-testid="offering">
              <p className="telemetry">{o.from} · {new Date(o.at).toLocaleDateString()}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-fg">“{o.excerpt}”</p>
              {d.notes.filter((n) => n.offering_id === o.id).map((n) => (
                <p key={n.id} className="mt-1 text-2xs text-muted" data-testid="witness-note">◉ {n.mine ? "you" : n.from}: {n.body}</p>
              ))}
              {o.mine ? (
                <MessageForm action={revokeOfferingAction} submitLabel="Withdraw" className="btn-line text-2xs">
                  <input type="hidden" name="offering_id" value={o.id} /><input type="hidden" name="constellation_id" value={cid} />
                </MessageForm>
              ) : (
                <MessageForm action={witnessAction} submitLabel="Witness" className="btn-line text-2xs">
                  <input type="hidden" name="offering_id" value={o.id} /><input type="hidden" name="constellation_id" value={cid} />
                  <input type="hidden" name="to_user" value={o.from_id} />
                  <input name="body" className="input" placeholder="what you see in them" />
                </MessageForm>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
