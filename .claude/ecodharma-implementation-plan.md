---
title: "EcoDharma — Implementation Plan"
type: implementation-plan
author: "Benjamin Life (@omniharmonic)"
status: draft
version: 0.1
created: 2026-06-20
description: "A phased, task-level build plan for EcoDharma with canonical code samples and dependency tagging throughout. Companion to the PRD and Technical Architecture."
companions:
  - "ecodharma-prd.md"
  - "ecodharma-technical-architecture.md"
---

# EcoDharma — Implementation Plan

Companion to the [PRD](ecodharma-prd.md) and [Technical Architecture](ecodharma-technical-architecture.md). This is the build itself: phases → tasks → subtasks, with canonical code and explicit dependency tags so nothing starts before its inputs exist.

---

## 0. How to read this plan

**Phase / task IDs.** Phases are `M0`–`M5` (then Phase 2). Tasks are `M1.T2`; subtasks are `M1.T2.3`.

**Dependency tags** appear on every task:

| Tag | Meaning |
|---|---|
| `[→ dep: M1.T2]` | Hard dependency on another task; cannot start until it's done |
| `[⊃ soft: M3.T1]` | Soft dependency; can start in parallel, integrates later |
| `[⚠ ext: …]` | External / human input required (a repo, a credential, your sign-off) |
| `[◆ decision: PRD §5.2]` | Blocked on a product/architecture decision |
| `[pkg: name@ver]` | Package/version this task introduces |
| `[blocks: M4.*]` | Downstream work this gates |

**Three hard external gates** sit in front of the whole build. Everything is sequenced around them:

- `[⚠ ext: FRAMEWORK-SIGNOFF]` — your sign-off on the §5.2 framework shape. **Gates M0.**
- `[⚠ ext: GOLDEN-CALF]` — the Golden Calf repo, to mirror your exact ephemeris setup/JSON shape. **Gates M1.**
- `[⚠ ext: WIKI-ACCESS]` — access method for `wiki.omniharmonic.com`. **Gates M0.T1.**

**Stack baseline** (from the architecture doc): Next.js (App Router) + Vercel · Supabase (Postgres/Auth/RLS/Storage/Realtime) · FastAPI ephemeris service · Claude API (`claude-opus-4-8`, `claude-sonnet-4-6`).

---

## Phase M0 — Framework distillation *(the keystone)*

**Goal:** produce the versioned **Framework Artifact** — the source of truth every interpretation and match depends on. Nothing downstream is worth building until this is good.

`[◆ decision: PRD §5.2 framework shape]` · `[⚠ ext: FRAMEWORK-SIGNOFF]` · `[⚠ ext: WIKI-ACCESS]` · `[blocks: M3, M4]`

### M0.T1 — Corpus ingestion & normalization
`[⚠ ext: WIKI-ACCESS]` · `[pkg: python-frontmatter, markdown-it-py, httpx]`

- **M0.T1.1** Collect sources: all project `.md` essays + `wiki.omniharmonic.com` export/crawl.
- **M0.T1.2** Strip YAML frontmatter, normalize to plain prose + metadata; preserve `[[wikilinks]]` as edges.
- **M0.T1.3** Chunk semantically (by section/heading, ~1–2k tokens), retaining `source_path` + `heading_path` for provenance.
- **M0.T1.4** Emit a `corpus_manifest.json` (chunk id → source, title, headings, links).

```python
# m0/ingest.py  — corpus → normalized, provenance-tagged chunks
import frontmatter, hashlib, json, re
from pathlib import Path

def chunk_markdown(text: str, source: str, max_chars: int = 6000):
    # Split on H2/H3 boundaries, keep heading context with each chunk.
    parts = re.split(r"(?m)^(#{2,3}\s.*)$", text)
    chunks, heading = [], ""
    for seg in parts:
        if re.match(r"^#{2,3}\s", seg or ""):
            heading = seg.strip("# ").strip()
            continue
        body = (seg or "").strip()
        if not body:
            continue
        for i in range(0, len(body), max_chars):
            piece = body[i:i + max_chars]
            cid = hashlib.sha1(f"{source}:{heading}:{i}".encode()).hexdigest()[:12]
            chunks.append({"id": cid, "source": source, "heading": heading, "text": piece})
    return chunks

def ingest(corpus_dir: str) -> list[dict]:
    out = []
    for p in Path(corpus_dir).glob("*.md"):
        post = frontmatter.load(p)
        out += chunk_markdown(post.content, source=p.name)
    Path("artifacts/corpus_manifest.json").write_text(json.dumps(out, indent=2))
    return out
```

### M0.T2 — The distillation swarm (map)
`[→ dep: M0.T1]` · `[pkg: anthropic>=0.40, asyncio]`

Parallel agents, one per facet, each extracting candidates with provenance. Facets: **domains, gifts/archetypes, trim-tab patterns, key concepts, edges**. Joe Lightfoot's archetypes enter here as one credited input, then are transcended.

```python
# m0/swarm.py  — map step: facet extractors over corpus chunks
import asyncio, json
from anthropic import AsyncAnthropic

client = AsyncAnthropic()

FACET_PROMPTS = {
    "domains":   "Extract REGENERATIVE DOMAINS (arenas of the Great Turning) discussed in this text.",
    "gifts":     "Extract GIFTS / ARCHETYPES (ways a person serves the transition) implied or named.",
    "trim_tabs": "Extract TRIM-TAB PATTERNS: small high-leverage actions that create upward spirals.",
    "concepts":  "Extract KEY CONCEPTS with a one-line definition in the author's own framing.",
}

EXTRACT_TOOL = {
    "name": "record_findings",
    "description": "Record structured findings extracted from the passage.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "evidence_quote": {"type": "string", "description": "≤15 words, verbatim anchor"},
                    },
                    "required": ["name", "description"],
                },
            }
        },
        "required": ["items"],
    },
}

async def extract(facet: str, chunk: dict) -> dict:
    msg = await client.messages.create(
        model="claude-sonnet-4-6",                # map step: fast + cheap
        max_tokens=1500,
        tools=[EXTRACT_TOOL],
        tool_choice={"type": "tool", "name": "record_findings"},
        system=(
            "You are a careful analyst distilling Benjamin Life's regenerative corpus. "
            "Extract only what is genuinely present. Preserve his framing and vocabulary."
        ),
        messages=[{
            "role": "user",
            "content": f"{FACET_PROMPTS[facet]}\n\nSOURCE: {chunk['source']} › {chunk['heading']}\n\n{chunk['text']}",
        }],
    )
    found = next((b.input for b in msg.content if b.type == "tool_use"), {"items": []})
    return {"facet": facet, "source": chunk["source"], **found}

async def run_map(chunks: list[dict], facets=tuple(FACET_PROMPTS)):
    sem = asyncio.Semaphore(8)                    # bound concurrency / rate limits
    async def guarded(f, c):
        async with sem:
            return await extract(f, c)
    tasks = [guarded(f, c) for c in chunks for f in facets]
    return await asyncio.gather(*tasks)
```

- **M0.T2.1** Implement facet extractors (above). `[pkg: anthropic]`
- **M0.T2.2** Bound concurrency + retry/backoff on 429/529.
- **M0.T2.3** Persist raw findings with provenance to `artifacts/findings.jsonl`.

### M0.T3 — Synthesis (reduce)
`[→ dep: M0.T2]`

- **M0.T3.1** Cluster/merge candidates per facet (dedupe near-synonyms; an Opus pass does the semantic merge).
- **M0.T3.2** Resolve overlaps into a coherent taxonomy; attach provenance to each node.
- **M0.T3.3** Derive `trim_tabs` as `gift × domain` intersections with explicit upward-spiral logic.
- **M0.T3.4** Emit a **draft** Framework Artifact (schema below).

```python
# m0/reduce.py — reduce step: one Opus pass synthesizes a coherent taxonomy
async def synthesize(findings: list[dict]) -> dict:
    msg = await client.messages.create(
        model="claude-opus-4-8",                  # reduce step: deep synthesis
        max_tokens=8000,
        system=(
            "Synthesize these raw findings into ONE coherent framework of regenerative "
            "civilization in Benjamin Life's voice and structure: Domains × Gifts → Trim-tabs, "
            "validated by an Ikigai lens. Merge synonyms. Keep provenance. Output JSON only, "
            "matching the provided schema. Do not invent beyond the evidence."
        ),
        messages=[{"role": "user", "content": json.dumps(findings)[:600_000]}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    return json.loads(text)
```

### M0.T4 — Human curation & versioning `[⚠ ext: FRAMEWORK-SIGNOFF]`

- **M0.T4.1** You review the draft; we refine domains/gifts/trim-tabs together (highest-leverage human step — swarm proposes, you dispose).
- **M0.T4.2** Freeze `framework_version: 1.0.0`; commit `framework.json` to the repo.
- **M0.T4.3** Write a short human-readable companion (`framework.md`) for transparency/commons.

**Framework Artifact schema (canonical):**

```json
{
  "framework_version": "1.0.0",
  "voice_ref": "ecodharma-voice@1.0.0",
  "domains": [
    { "id": "economic", "name": "Economic", "description": "…",
      "sub_domains": ["cooperatives", "local-currency", "bioregional-finance"],
      "sources": ["upward-spiral-economics.md"] }
  ],
  "gifts": [
    { "id": "weaver", "name": "The Weaver", "description": "…",
      "shadow": "over-extends holding others together; neglects own thread",
      "modality_signals": { "human_design": ["channel 19-49"], "western": ["Libra stellium"] },
      "sources": ["the-infrastructure-of-belonging.md"] }
  ],
  "trim_tabs": [
    { "id": "tt-weaver-economic", "gift_id": "weaver", "domain_id": "economic",
      "pattern": "convene a solidarity squad from existing relationships",
      "upward_spiral_logic": "each new node increases circulation and viability of the next",
      "sources": ["upward-spiral-economics.md"] }
  ],
  "ikigai_lens": { "love": "…", "skill": "…", "world_need": "…", "livelihood": "…" }
}
```

**M0 deliverable:** `framework.json` (v1.0.0) + `framework.md`, signed off.

---

## Phase M1 — Ephemeris service

**Goal:** birth data → structured chart JSON for every modality. Free, self-hosted, auditable. Returns **positions/structural facts only** — zero proprietary descriptive text (IP boundary lives here).

`[⚠ ext: GOLDEN-CALF]` · `[pkg: fastapi, uvicorn, pydantic>=2, kerykeion==5.12.9, human-design-py]` · `[blocks: M3.T1]`

> `[⚠ ext: GOLDEN-CALF]` — confirm the exact library + JSON shape you used so this mirrors your working setup 1:1 rather than re-deriving. Kerykeion is the assumed Western/Vedic engine below; swap if Golden Calf differs.

### M1.T1 — Service skeleton & contracts
`[pkg: fastapi, uvicorn[standard], pydantic>=2]`

```python
# ephemeris/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

app = FastAPI(title="EcoDharma Ephemeris Service", version="0.1.0")

class BirthData(BaseModel):
    name: str = "Subject"
    year: int; month: int; day: int
    hour: Optional[int] = None
    minute: Optional[int] = None
    lat: float; lng: float
    tz_str: str
    unknown_time: bool = False

class ChartResponse(BaseModel):
    modality: str
    engine_version: str
    time_dependent_fields: list[str] = Field(default_factory=list)
    data: dict

@app.get("/healthz")
def healthz(): return {"ok": True}
```

- **M1.T1.1** Define `BirthData` / `ChartResponse` Pydantic contracts (above).
- **M1.T1.2** Vendoring strategy for Swiss Ephemeris data files; set `EPHE_PATH`.
- **M1.T1.3** Process-wide ephemeris lock note (Kerykeion guards sidereal/tropical state; serialize or pool workers accordingly).

### M1.T2 — Western & Vedic endpoints
`[→ dep: M1.T1]` · `[pkg: kerykeion==5.12.9]`

```python
# ephemeris/astrology.py
from kerykeion import AstrologicalSubjectFactory
from kerykeion.chart_data_factory import ChartDataFactory

def _subject(b, zodiac_type="Tropic", sidereal_mode=None):
    return AstrologicalSubjectFactory.from_birth_data(
        b.name, b.year, b.month, b.day,
        (b.hour or 12), (b.minute or 0),
        lng=b.lng, lat=b.lat, tz_str=b.tz_str, online=False,
        zodiac_type=zodiac_type, sidereal_mode=sidereal_mode,
    )

TIME_DEPENDENT = ["Ascendant", "Medium_Coeli", "houses", "Moon"]

def western_chart(b) -> dict:
    subj = _subject(b)                                   # tropical
    return {"subject": subj.model_dump(),
            "context": ChartDataFactory.create_natal_chart_data(subj).model_dump()}

def vedic_chart(b) -> dict:
    subj = _subject(b, zodiac_type="Sidereal", sidereal_mode="LAHIRI")
    d = subj.model_dump()
    d["ayanamsa_value"] = getattr(subj, "ayanamsa_value", None)
    return {"subject": d}
```

```python
# ephemeris/main.py (routes)
from .astrology import western_chart, vedic_chart, TIME_DEPENDENT

@app.post("/charts/western", response_model=ChartResponse)
def western(b: BirthData):
    return ChartResponse(
        modality="western", engine_version="kerykeion-5.12.9",
        time_dependent_fields=TIME_DEPENDENT if b.unknown_time else [],
        data=western_chart(b))

@app.post("/charts/vedic", response_model=ChartResponse)
def vedic(b: BirthData):
    return ChartResponse(modality="vedic", engine_version="kerykeion-5.12.9",
                         time_dependent_fields=TIME_DEPENDENT if b.unknown_time else [],
                         data=vedic_chart(b))
```

- **M1.T2.1** Tropical natal endpoint. `[pkg: kerykeion]`
- **M1.T2.2** Sidereal/Vedic endpoint (Lahiri default; expose ayanamsa).
- **M1.T2.3** Note Kerykeion's built-in **AI-context serializer** — optionally return its prompt-ready string alongside JSON to feed M3 directly.

### M1.T3 — Human Design & Gene Keys endpoints
`[→ dep: M1.T1]` · `[pkg: human-design-py]` · `[⚠ ext: verify HD lib signature vs repo]`

HD computes from personality (birth) + design (≈88° solar arc before birth). Gene Keys' core sequences derive from the **same** gate math (Sun/Earth × personality/design), so we compute once.

```python
# ephemeris/human_design.py  —  thin wrapper; verify exact API against the pinned lib
# Returns positions/structure ONLY. No proprietary descriptive text. (IP boundary.)
from datetime import datetime
import human_design as hd   # [⚠ ext: confirm import + call signature vs human-design-py repo]

def _utc_offset_hours(tz_str: str, dt: datetime) -> float:
    from zoneinfo import ZoneInfo
    return dt.replace(tzinfo=ZoneInfo(tz_str)).utcoffset().total_seconds() / 3600

def human_design_chart(b) -> dict:
    dt = datetime(b.year, b.month, b.day, b.hour or 12, b.minute or 0)
    chart = hd.create_chart(                       # ← signature TBD; wrap, don't assume
        year=b.year, month=b.month, day=b.day,
        hour=b.hour or 12, minute=b.minute or 0,
        lat=b.lat, lng=b.lng, utc_offset=_utc_offset_hours(b.tz_str, dt),
    )
    return {
        "type": chart.type, "profile": chart.profile, "authority": chart.authority,
        "defined_centers": chart.defined_centers, "channels": chart.channels,
        "gates": {                                 # gate+line per planet, both sides
            "personality": chart.personality_gates,  # e.g. {"Sun": {"gate": 34, "line": 2}, ...}
            "design": chart.design_gates,
        },
    }

def gene_keys_sequences(hd_data: dict) -> dict:
    # Derived from the SAME gate computation. Positions only; original interpretation later.
    p, d = hd_data["gates"]["personality"], hd_data["gates"]["design"]
    return {
        "activation_sequence": {                   # the 4 prime gifts
            "lifes_work": p["Sun"], "evolution":  p["Earth"],
            "radiance":   d["Sun"], "purpose":    d["Earth"],
        }
    }
```

- **M1.T3.1** HD wrapper returning type/profile/authority/centers/channels/gates. `[pkg: human-design-py]`
- **M1.T3.2** Gene Keys sequence derivation from HD gates (positions only).
- **M1.T3.3** **IP guard test:** assert responses contain no descriptive prose fields (CI check). `[blocks: launch]`
- **M1.T3.4** `unknown_time` ⇒ flag HD/GK as low-confidence (highly time-sensitive).

### M1.T4 — Synastry endpoint (for constellations)
`[→ dep: M1.T2]` · `[⊃ soft: M4]`

```python
# ephemeris/synastry.py
from kerykeion import SynastryAspects
from .astrology import _subject

def synastry(a, b) -> dict:
    aspects = SynastryAspects(_subject(a), _subject(b)).get_relevant_aspects()
    return {"aspects": aspects}   # [{p1_name, p2_name, aspect, orbit, aspect_degrees, ...}]
```

### M1.T5 — Containerize & deploy
`[→ dep: M1.T2, M1.T3]` · `[pkg: docker]`

```dockerfile
# ephemeris/Dockerfile
FROM python:3.11-slim
ENV EPHE_PATH=/app/ephe
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY ephe/ /app/ephe/                # bundled Swiss Ephemeris data files
EXPOSE 8000
CMD ["uvicorn", "ephemeris.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- **M1.T5.1** Deploy to Railway/Fly.io; private networking to Vercel; service token auth.
- **M1.T5.2** Golden test charts (known birth data → expected gates/signs) to lock accuracy. `[⚠ ext: GOLDEN-CALF reference values]`
- **M1.T5.3** Rate-limit + timeout; `/healthz` wired to platform health checks.

**M1 deliverable:** deployed ephemeris service, all five modalities, golden-tested, IP-guarded.

---

## Phase M2 — Auth, data model, consent

**Goal:** the persistence + consent backbone. Consent enforced in the **database**, not just the app.

`[pkg: supabase-js, @supabase/ssr, pgsodium]` · `[blocks: M3, M4]`

### M2.T1 — Supabase project & auth
- **M2.T1.1** Provision project; configure Auth (email/OAuth); set up `@supabase/ssr` in Next.js.
- **M2.T1.2** Environments (dev/prod), secrets, service-role key server-only.

### M2.T2 — Schema (DDL)
`[→ dep: M2.T1]`

```sql
-- m2/schema.sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, bioregion text, pronouns text,
  settings jsonb default '{}'::jsonb, created_at timestamptz default now()
);

create table birth_data (                       -- sensitive PII
  user_id uuid primary key references auth.users on delete cascade,
  birth_date date not null, birth_time time,    -- nullable: unknown-time support
  lat double precision not null, lng double precision not null,
  tz_str text not null, unknown_time boolean default false
);

create table charts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  modality text not null,                        -- western|vedic|human_design|gene_keys
  raw_json jsonb not null, engine_version text not null,
  computed_at timestamptz default now(),
  unique (user_id, modality)
);

create table gift_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  framework_version text not null, voice_version text not null,
  content_json jsonb not null, status text default 'ready',
  generated_at timestamptz default now()
);

create table offerings (
  user_id uuid primary key references auth.users on delete cascade,
  skills text[] default '{}', offerings text[] default '{}', availability text
);

create table consents (                          -- the consent ledger
  id bigint generated always as identity primary key,
  granter_id uuid not null references auth.users on delete cascade,
  grantee_id uuid references auth.users on delete cascade,
  constellation_id bigint,
  scope text not null default 'constellation',   -- what is shared
  granted_at timestamptz default now(), revoked_at timestamptz
);

create table constellations (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users on delete cascade,
  name text, type text not null default 'group', -- one_to_one|group
  created_at timestamptz default now()
);

create table constellation_members (
  constellation_id bigint references constellations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  consent_id bigint references consents,
  role text, primary key (constellation_id, user_id)
);

create table constellation_reads (
  id bigint generated always as identity primary key,
  constellation_id bigint references constellations on delete cascade,
  framework_version text not null, content_json jsonb not null,
  generated_at timestamptz default now()
);

create table framework_versions (
  version text primary key, artifact_json jsonb not null,
  changelog text, published_at timestamptz default now()
);
```

### M2.T3 — Row-Level Security & the consent gate
`[→ dep: M2.T2]` · `[blocks: M4]`

The structural guarantee that **no one's data is used without consent.**

```sql
-- m2/rls.sql
alter table birth_data    enable row level security;
alter table charts        enable row level security;
alter table gift_profiles enable row level security;
alter table consents      enable row level security;

-- Owner-only for sensitive tables
create policy owner_birth on birth_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy owner_charts on charts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A profile is readable by another user ONLY with active, unrevoked consent.
create or replace function has_consent(target uuid, viewer uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from consents c
    where c.granter_id = target and c.grantee_id = viewer
      and c.revoked_at is null
  );
$$;

create policy own_or_consented_profile on gift_profiles
  for select using (
    auth.uid() = user_id or has_consent(user_id, auth.uid())
  );

-- Consent rows are managed only by the granter
create policy manage_own_consent on consents
  for all using (auth.uid() = granter_id) with check (auth.uid() = granter_id);
```

- **M2.T3.1** Enable RLS on all sensitive tables; owner-only policies.
- **M2.T3.2** `has_consent()` + consent-gated profile read policy (above).
- **M2.T3.3** **Consent tests** (RLS test suite): granter/grantee/third-party matrix. `[blocks: launch]`
- **M2.T3.4** Encrypt `birth_data` at rest (pgsodium/Vault) or app-layer envelope encryption. `[pkg: pgsodium]`

### M2.T4 — Typed data access + framework loader
`[→ dep: M2.T2]`

- **M2.T4.1** Generate TS types from schema (`supabase gen types`).
- **M2.T4.2** Seed `framework_versions` from M0's `framework.json`; loader util reads current version.

**M2 deliverable:** schema + RLS + consent gate, tested; framework loaded into DB.

---

## Phase M3 — Reading → Gift Profile

**Goal:** the core magic. Onboard → compute charts → interpret through the framework in the EcoDharma voice → persist a consistent profile → render it.

`[→ dep: M0 (framework.json), M1 (ephemeris), M2 (schema/auth)]` · `[pkg: @anthropic-ai/sdk]` · `[blocks: M4]`

### M3.T1 — Onboarding & birth-data capture
`[→ dep: M2.T2]`

- **M3.T1.1** Birth date/time/location form; location → lat/lng/tz (GeoNames or `tz-lookup`).
- **M3.T1.2** "I don't know my birth time" path → sets `unknown_time`; UI explains what becomes uncertain.
- **M3.T1.3** Persist to `birth_data` (RLS owner-only).

### M3.T2 — Reading ingestion (charts → DB)
`[→ dep: M1.T5, M3.T1]`

```typescript
// app/lib/ephemeris.ts  — server-only client for the ephemeris service
const BASE = process.env.EPHEMERIS_URL!;          // private network
const TOKEN = process.env.EPHEMERIS_TOKEN!;

export async function computeChart(modality: string, birth: BirthInput) {
  const res = await fetch(`${BASE}/charts/${modality}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(birth),
  });
  if (!res.ok) throw new Error(`ephemeris ${modality} failed: ${res.status}`);
  return res.json() as Promise<ChartResponse>;
}
```

```typescript
// app/actions/ingest.ts  — 'use server'
"use server";
import { createClient } from "@/lib/supabase/server";
import { computeChart } from "@/lib/ephemeris";

const MODALITIES = ["western", "vedic", "human_design", "gene_keys"] as const;

export async function ingestReadings(birth: BirthInput) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  for (const m of MODALITIES) {
    const chart = await computeChart(m, birth);
    await supabase.from("charts").upsert({
      user_id: user.id, modality: m,
      raw_json: chart.data, engine_version: chart.engine_version,
    }, { onConflict: "user_id,modality" });
  }
}
```

### M3.T3 — The interpretation engine (voice + framework + charts → profile)
`[→ dep: M3.T2]` · `[pkg: @anthropic-ai/sdk]`

The framework and the EcoDharma voice are **stable prefixes** → cache them (`cache_control`) to cut cost. Structured output via a forced tool.

```typescript
// app/lib/interpret.ts  — server-only
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic();

const PROFILE_TOOL = {
  name: "gift_profile",
  description: "Structured EcoDharma gift profile.",
  input_schema: {
    type: "object",
    properties: {
      unique_gifts: { type: "array", items: { type: "string" } },
      domains: { type: "array", items: {
        type: "object",
        properties: { domain_id: {type:"string"}, why: {type:"string"}, expression: {type:"string"} },
        required: ["domain_id", "why"] } },
      trim_tabs: { type: "array", items: {
        type: "object",
        properties: { action:{type:"string"}, domain_id:{type:"string"},
          gift_basis:{type:"string"}, upward_spiral:{type:"string"}, ikigai_fit:{type:"string"} },
        required: ["action", "domain_id"] } },
      shadow: { type: "array", items: {
        type: "object",
        properties: { pattern:{type:"string"}, how_to_relate:{type:"string"} } } },
      narrative: { type: "string", description: "EcoDharma-voice prose tying it together" },
    },
    required: ["unique_gifts", "domains", "trim_tabs", "narrative"],
  },
} as const;

export async function generateGiftProfile(opts: {
  voice: string; framework: object; charts: Record<string, unknown>; ikigai: object;
}) {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",                        // deep multi-modal synthesis
    max_tokens: 4000,
    tools: [PROFILE_TOOL],
    tool_choice: { type: "tool", name: "gift_profile" },
    system: [
      { type: "text", text: opts.voice, cache_control: { type: "ephemeral" } },        // stable
      { type: "text", text: `FRAMEWORK:\n${JSON.stringify(opts.framework)}`,
        cache_control: { type: "ephemeral" } },                                        // stable
    ],
    messages: [{
      role: "user",
      content:
        `Interpret this person THROUGH the framework, in the EcoDharma voice. ` +
        `Map gifts→domains→trim-tabs; validate each trim-tab with the Ikigai lens. ` +
        `For Gene Keys/Human Design, speak in original language — never reproduce ` +
        `proprietary descriptive text.\n\nCHARTS:\n${JSON.stringify(opts.charts)}\n\n` +
        `IKIGAI:\n${JSON.stringify(opts.ikigai)}`,
    }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  return block?.input;   // typed gift profile
}
```

- **M3.T3.1** Voice system prompt asset (`ecodharma-voice@1.0.0`) — versioned, in repo. `[◆ decision: PRD §9 voice]`
- **M3.T3.2** Context assembler (load charts + framework + ikigai). `[→ dep: M2.T4]`
- **M3.T3.3** Forced-tool structured output (above); validate against schema.
- **M3.T3.4** Prompt caching on voice + framework prefixes (cost control).
- **M3.T3.5** Persist to `gift_profiles` with `framework_version` + `voice_version` pinned (consistency + reproducibility).

### M3.T4 — Ikigai reflection
`[⊃ soft: M3.T3]`

- **M3.T4.1** Guided four-fold questionnaire (love / skill / world-need / livelihood).
- **M3.T4.2** Optional Claude-assisted clarifying follow-ups (`claude-sonnet-4-6`).
- **M3.T4.3** Persist; feed into interpretation.

### M3.T5 — Profile UI
`[→ dep: M3.T3]` · `[pkg: tailwindcss, shadcn-ui]` · `[⊃ soft: frontend-design skill]`

- **M3.T5.1** Profile view: gifts, domains, trim-tabs, shadow, narrative — a "wow" surface.
- **M3.T5.2** Regenerate-on-request (only path that re-bills AI); version badge.
- **M3.T5.3** Loading/streaming states; resonance thumbs (success metric capture).

**M3 deliverable:** a logged-in user gets a persisted, consistent Gift Profile in the EcoDharma voice.

---

## Phase M4 — Constellations

**Goal:** user-composed constellations with consent-gated, framework-driven collaboration reads.

`[→ dep: M3 (profiles), M2.T3 (consent gate), M1.T4 (synastry)]`

### M4.T1 — Invitations & active consent
`[→ dep: M2.T3]`

- **M4.T1.1** Create constellation; invite by handle/email.
- **M4.T1.2** Invitee **actively opts in** → writes a `consents` row (granular, revocable).
- **M4.T1.3** Revoke flow → sets `revoked_at`; downstream reads immediately lose access (RLS).
- **M4.T1.4** Never load a non-consented profile (enforced by RLS + app assert).

### M4.T2 — Synastry & constellation read
`[→ dep: M4.T1, M1.T4]`

```typescript
// app/actions/constellation.ts  — 'use server'
"use server";
import { createClient } from "@/lib/supabase/server";
import { generateConstellationRead } from "@/lib/interpret-constellation";

export async function composeConstellationRead(constellationId: number) {
  const supabase = createClient();
  // RLS ensures only consented member profiles are returned here.
  const { data: members } = await supabase
    .from("constellation_members")
    .select("user_id, gift_profiles(content_json), charts(modality, raw_json)")
    .eq("constellation_id", constellationId);

  if (!members?.length) throw new Error("no consented members");

  const read = await generateConstellationRead({ members });  // Opus for 1:many, Sonnet for 1:1
  await supabase.from("constellation_reads").insert({
    constellation_id: constellationId,
    framework_version: await currentFrameworkVersion(),
    content_json: read,
  });
  return read;
}
```

- **M4.T2.1** 1:1 read (complementarities, frictions, "what to make explicit"). `[pkg: @anthropic-ai/sdk]`
- **M4.T2.2** 1:many read (collective gift map, gaps vs. chosen domains, weaving guidance).
- **M4.T2.3** Model routing: `claude-sonnet-4-6` for pairs, `claude-opus-4-8` for groups.
- **M4.T2.4** Re-generate on membership change or framework bump.

### M4.T3 — Constellation UI + realtime
`[→ dep: M4.T2]` · `[pkg: @supabase/realtime-js]`

- **M4.T3.1** Composer (add/remove members, see consent status live via Realtime).
- **M4.T3.2** Constellation read view; per-relationship guidance.

**M4 deliverable:** consented, composable constellations with collaboration reads.

---

## Phase M5 — Offerings, PWA, polish, paid gating

`[→ dep: M3, M4]`

### M5.T1 — Offerings on profile `[⊃ soft: Phase 2 marketplace]`
- Lightweight skills/offerings capture (seeds the marketplace; no matching yet).

### M5.T2 — PWA `[pkg: next-pwa or custom service worker]`
- Installable manifest, offline-aware shell, mobile-first layouts + strong desktop. **No browser storage in artifacts/app for sensitive data** — server-side only.

### M5.T3 — Free/paid gating `[◆ decision: PRD §11]`
```typescript
// app/lib/entitlements.ts
export async function assertWithinQuota(userId: string, feature: "profile_regen"|"large_constellation") {
  // Free: core profile + N constellations. Paid: heavy AI features.
  const used = await countUsage(userId, feature);
  const limit = await limitFor(userId, feature);     // tier-aware
  if (used >= limit) throw new PaywallError(feature);
}
```
- Gate AI-heavy actions (regeneration, large constellations, future forecasts) behind tier checks.

### M5.T4 — Design pass, a11y, launch hardening
- Distinctive visual identity on hero surfaces (`[⊃ soft: frontend-design skill]`); accessibility; error states; the IP-guard + consent test suites green. `[blocks: launch]`

**M5 deliverable:** installable, polished, monetization-ready v1.

---

## Phase 2 — Forecast & marketplace *(summary)*

- **Forecast/nudge engine:** scheduled transit computation (`/charts/transits`) vs. each opted-in natal chart + constellations → voice-consistent nudges via web-push/email. `[→ dep: M1.T4-style transits, M4]`
- **Marketplace v1:** `projects` express `needs` in framework terms (domains/gifts/trim-tabs); match against `offerings`; surface aligned invitations. Reuses the M0 taxonomy — no parallel ontology. `[→ dep: M5.T1, M0]`

---

## Cross-cutting workstreams (run continuously)

| Workstream | Tasks | Tags |
|---|---|---|
| **CI/CD** | Lint/typecheck/test on PR; deploy Vercel + ephemeris on merge | `[pkg: github-actions]` |
| **Testing** | Golden charts (M1.T5.2), RLS/consent matrix (M2.T3.3), IP-guard (M1.T3.3), profile-consistency snapshot | `[blocks: launch]` |
| **Observability** | Structured logs; Claude token/cost metering per feature; ephemeris latency | `[⊃ soft: M3, M4]` |
| **Security/privacy** | Birth-data encryption, export/delete, service keys server-only, consent audit log | `[blocks: launch]` |
| **Parachute (optional)** | Sync profiles/people/notes via MCP under same consent rules | `[⊃ soft: M3]` `[⚠ ext: Parachute MCP in session]` |

---

## Critical path & sequencing

```
M0 (framework) ──┐
                 ├─► M3 (reading→profile) ──► M4 (constellations) ──► M5 (polish/PWA/paid) ──► launch
M1 (ephemeris) ──┤                                        ▲
M2 (schema+RLS) ─┘                                        │
                              (consent gate from M2.T3) ──┘
```

**Parallelizable from day one:** M0, M1, M2 have no inter-dependencies and should run concurrently. M3 is the first convergence point (needs all three). 

**My recommended start (de-risk the hardest first):** **M0 + M1 in parallel.** M0 because the framework is the keystone and needs your curation loop; M1 because the multi-modal ephemeris (esp. HD/Gene-Keys derivation + IP boundary) is the gnarliest engineering. M2 can start the moment we want persistence. UI (M3.T5 onward) comes after the engine works headless.

---

## Open external dependencies (consolidated)

| Tag | Needed for | Ask |
|---|---|---|
| `[⚠ ext: FRAMEWORK-SIGNOFF]` | M0.T4 → unblocks M3/M4 | Sign off the §5.2 framework shape |
| `[⚠ ext: GOLDEN-CALF]` | M1.T2/T5 | Point me at the repo (library + JSON shape + reference charts) |
| `[⚠ ext: WIKI-ACCESS]` | M0.T1 | How should I ingest wiki.omniharmonic.com (export/API/crawl)? |
| `[⚠ ext: HD lib signature]` | M1.T3 | I'll pin & verify `human-design-py` against its repo during build |
| `[◆ decision: voice@1.0.0]` | M3.T3 | Lock the EcoDharma voice system prompt (I'll draft from §9) |
| `[◆ decision: AGPL stance]` | M1, licensing | Confirm full-open (embrace Kerykeion AGPL) vs. permissive swap |

---

*Authored with and for Benjamin Life (@omniharmonic). Offered toward the commons.*
