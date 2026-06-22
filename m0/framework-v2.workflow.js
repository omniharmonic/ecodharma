export const meta = {
  name: 'ecodharma-framework-v2',
  description: 'Author Framework v2.0.0 — Macy-centered, general, lean — per the redesign spec, grounded in the corpus',
  phases: [
    { title: 'Author', detail: 'domains, gifts, meta in parallel (per spec)' },
    { title: 'Trim-tabs', detail: 'generic gift×domain starting actions' },
  ],
}

const ROOT = '/Users/benjaminlife/iCloud Drive (Archive)/Documents/cursor projects/ecodharma'
const SPEC = `${ROOT}/docs/redesign/framework_spec.md`
const READ = `Read the redesign spec at ${SPEC} (authoritative for structure + voice). Ground language in these corpus files where useful: ${ROOT}/omniharmonic-wiki/wiki/concepts/the-great-turning.md, ${ROOT}/omniharmonic-wiki/wiki/writing/awakening-the-earth-dharma-part-i.md.`
const VOICE = `VOICE: general, warm, plain. A stranger in any walk of life should recognize themselves. NO insider jargon (no 'wetiko', 'egregore', 'compost capital', 're/acc', 'cosmolocalism' as primary terms). Credit lineage once (handled separately), never name-drop authors in node text.`

phase('Author')

const DIMENSIONS = [
  { id: 'holding-actions', name: 'Holding Actions', gloss: 'slowing the damage — protecting life and buying time' },
  { id: 'life-sustaining-systems', name: 'Life-Sustaining Systems', gloss: "Macy's Gaia structures — building the new" },
  { id: 'shift-in-consciousness', name: 'Shift in Consciousness', gloss: 'the perceptual/spiritual ground' },
]

const DOMAINS_SCHEMA = {
  type: 'object',
  properties: {
    domains: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'kebab-case' },
          name: { type: 'string' },
          dimension: { type: 'string', enum: DIMENSIONS.map((d) => d.id) },
          description: { type: 'string', description: 'ONE plain sentence a stranger understands' },
          examples: { type: 'array', items: { type: 'string' }, description: '3-4 concrete, everyday examples' },
        },
        required: ['id', 'name', 'dimension', 'description', 'examples'],
      },
    },
  },
  required: ['domains'],
}

const GIFTS_SCHEMA = {
  type: 'object',
  properties: {
    gifts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'kebab-case, e.g. the-weaver' },
          name: { type: 'string', description: 'universal archetype, e.g. The Weaver, The Toolmaker, The Seer, The Guardian' },
          essence: { type: 'string', description: 'one plain sentence: how this person serves' },
          shadow: { type: 'string', description: 'one plain sentence: how the gift over-reaches/distorts' },
          modality_signals: {
            type: 'object',
            description: 'SOFT priors only — 2-3 per system max',
            properties: {
              western: { type: 'array', items: { type: 'string' } },
              vedic: { type: 'array', items: { type: 'string' } },
              human_design: { type: 'array', items: { type: 'string' } },
              gene_keys: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['id', 'name', 'essence', 'shadow', 'modality_signals'],
      },
    },
  },
  required: ['gifts'],
}

const META_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'a few plain sentences describing the framework as a general map (no jargon)' },
    lineage: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, contribution: { type: 'string' } }, required: ['name', 'contribution'] },
      description: 'credit Joanna Macy (Great Turning, Work That Reconnects), Buckminster Fuller (trim-tab), Joe Lightfoot (regenerative archetypes), and others as apt — ONCE, here',
    },
    ikigai_lens: {
      type: 'object',
      properties: { love: { type: 'string' }, skill: { type: 'string' }, world_need: { type: 'string' }, livelihood: { type: 'string' } },
      required: ['love', 'skill', 'world_need', 'livelihood'],
    },
    dimensions: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } }, required: ['id', 'name', 'description'] },
    },
  },
  required: ['summary', 'lineage', 'ikigai_lens', 'dimensions'],
}

const [domainsR, giftsR, metaR] = await parallel([
  () => agent(
    `Author the v2 DOMAINS exactly per the redesign spec's table (9 domains, each nested under one of Macy's three dimensions). ${READ}\n${VOICE}\n` +
    `Each domain: kebab id, name, dimension (one of: ${DIMENSIONS.map((d) => `${d.id} = ${d.name}`).join('; ')}), ONE plain-sentence description, and 3-4 concrete everyday examples spanning many walks of life (not just web3/regen-insider examples).`,
    { label: 'author:domains', phase: 'Author', model: 'opus', schema: DOMAINS_SCHEMA },
  ),
  () => agent(
    `Author the v2 GIFTS exactly per the redesign spec (the ~10 universal archetypes it proposes — e.g. Weaver, Builder, Steward, Healer, Convener, Storyteller, Toolmaker, Seer, Guardian, Way-shower; follow the spec's final list). ${READ}\n${VOICE}\n` +
    `Each gift: kebab id, universal name, one-plain-sentence essence, one-plain-sentence shadow (gift-over-reaching, never deficit-shaming), and SOFT modality_signals (2-3 per system, framed as gentle priors not assertions).`,
    { label: 'author:gifts', phase: 'Author', model: 'opus', schema: GIFTS_SCHEMA },
  ),
  () => agent(
    `Author the framework META per the redesign spec. ${READ}\n${VOICE}\n` +
    `Provide: a plain-language summary (general map of participating in the Great Turning — credit the idea to Macy in passing, no jargon); a lineage array crediting Joanna Macy, Buckminster Fuller, Joe Lightfoot (and others as apt) ONCE; a plain ikigai_lens (love/skill/world_need/livelihood as validation questions); and the three dimensions (${DIMENSIONS.map((d) => d.name).join(', ')}) each with a clear 1-2 sentence description.`,
    { label: 'author:meta', phase: 'Author', model: 'opus', schema: META_SCHEMA },
  ),
])

const domains = domainsR?.domains || []
const gifts = giftsR?.gifts || []
log(`Authored ${domains.length} domains, ${gifts.length} gifts`)

phase('Trim-tabs')
const TT_SCHEMA = {
  type: 'object',
  properties: {
    trim_tabs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gift_id: { type: 'string' },
          domain_id: { type: 'string' },
          pattern: { type: 'string', description: 'a small, concrete, GENERIC starting action (reusable across people)' },
          why_it_compounds: { type: 'string', description: 'plain cause-and-effect: why each turn makes the next easier' },
        },
        required: ['gift_id', 'domain_id', 'pattern', 'why_it_compounds'],
      },
    },
  },
  required: ['trim_tabs'],
}

const ttR = await agent(
  `Author a LEAN set of generic trim-tabs (Fuller's small high-leverage moves) for the strongest gift × domain intersections. ${VOICE}\n` +
  `Aim for ~2-3 per gift across its most natural domains (~24-30 total, not exhaustive). Each: gift_id + domain_id (MUST be ids from the lists below), a concrete GENERIC pattern (a starting action anyone with that gift could take, NOT personalized), and plain why_it_compounds (no 'upward spiral' jargon — just clear cause and effect). Keep them practical and non-insider.\n\n` +
  `GIFTS:\n${JSON.stringify(gifts.map((g) => ({ id: g.id, name: g.name, essence: g.essence })))}\n\n` +
  `DOMAINS:\n${JSON.stringify(domains.map((d) => ({ id: d.id, name: d.name, dimension: d.dimension })))}`,
  { label: 'author:trim-tabs', phase: 'Trim-tabs', model: 'opus', schema: TT_SCHEMA },
)

return { domains, gifts, meta: metaR, trim_tabs: ttR?.trim_tabs || [] }
