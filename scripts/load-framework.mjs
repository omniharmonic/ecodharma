// Seed the distilled Framework Artifact into framework_versions (service role).
// Usage: node scripts/load-framework.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const fw = JSON.parse(readFileSync(resolve(root, "framework/framework.json"), "utf8"));
const CONN = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const client = new pg.Client({ connectionString: CONN });
await client.connect();
await client.query(
  `insert into framework_versions (version, artifact_json, changelog)
   values ($1, $2, $3)
   on conflict (version) do update set artifact_json = excluded.artifact_json, changelog = excluded.changelog`,
  [fw.framework_version, fw, "Distilled from omniharmonic corpus via M0 swarm"],
);
// Sync seed trim-tabs. On a framework version cutover, clear the whole library
// (old gift/domain ids would otherwise orphan generated candidates); it regrows.
await client.query("delete from trim_tabs");
for (const t of fw.trim_tabs || []) {
  await client.query(
    `insert into trim_tabs (gift_id, domain_id, pattern, upward_spiral_logic, source, status, framework_version)
     values ($1,$2,$3,$4,'seed','curated',$5)`,
    [t.gift_id, t.domain_id, t.pattern, t.why_it_compounds || t.upward_spiral_logic || "", fw.framework_version],
  );
}

const { rows } = await client.query("select version, jsonb_array_length(artifact_json->'gifts') as gifts from framework_versions order by published_at");
console.log("framework_versions:", rows);
const tt = await client.query("select source, status, count(*)::int n from trim_tabs group by 1,2 order by 1,2");
console.log("trim_tabs library:", tt.rows);
await client.end();
