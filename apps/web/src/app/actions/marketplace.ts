"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

const projectSchema = z.object({
  title: z.string().min(3, "Give your project a title."),
  description: z.string().min(1, "Add a short description."),
  place: z.string().optional(),
});

export async function createProjectAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const gifts = formData.getAll("needed_gifts").map(String).filter(Boolean);
  const domains = formData.getAll("needed_domains").map(String).filter(Boolean);
  if (gifts.length === 0 && domains.length === 0) {
    return { error: "Choose at least one gift or domain this project needs." };
  }

  const id = await withUser(user.id, async (c) => {
    const { rows } = await c.query(
      `insert into projects (owner_id, title, description, needed_gifts, needed_domains, place)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [user.id, parsed.data.title, parsed.data.description, gifts, domains, parsed.data.place || null],
    );
    return rows[0].id as number;
  });
  redirect(`/projects/${id}`);
}

export async function setDiscoverableAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const on = String(formData.get("discoverable")) === "on";
  await withUser(user.id, (c) =>
    c.query(
      `update profiles set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{discoverable}', $2::jsonb, true) where id=$1`,
      [user.id, JSON.stringify(on)],
    ),
  );
  revalidatePath("/work");
  return { ok: on ? "You're discoverable — projects can now find your gifts." : "You're no longer discoverable." };
}

export async function expressInterestAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const projectId = Number(formData.get("project_id"));
  const message = String(formData.get("message") || "").slice(0, 1000);
  await withUser(user.id, (c) =>
    c.query(
      `insert into project_interests (project_id, user_id, message) values ($1,$2,$3)
       on conflict (project_id, user_id) do update set message = excluded.message`,
      [projectId, user.id, message],
    ),
  );
  revalidatePath(`/projects/${projectId}`);
  return { ok: "Interest sent. The steward can see your gifts and reach out." };
}
