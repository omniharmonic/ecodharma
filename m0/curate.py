"""M0 curation pass 1 (signoff edits):
  1. Fold Spiritual/Sacred into Inner/Consciousness  (9 -> 8 domains)
  2. Merge gift overlaps: Caregiver -> Healer, Bridgekeeper -> Weaver  (14 -> 12 gifts)
  3. Reframe modality_signals as soft heuristic priors (top-level note)
Bumps framework_version 1.0.0 -> 1.1.0. Deterministic; re-runnable from the 1.0.0 base.
"""
import json, collections, sys

fw = json.load(open("framework/framework.json"))
if fw["framework_version"] != "1.0.0":
    print(f"expected base 1.0.0, found {fw['framework_version']}; aborting", file=sys.stderr); sys.exit(1)

def by_id(items): return {x["id"]: x for x in items}
domains = by_id(fw["domains"]); gifts = by_id(fw["gifts"])

def uniq(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen: seen.add(x); out.append(x)
    return out

# ---- 1. domain fold: spiritual-sacred -> inner-consciousness-work ----
inner, sacred = domains["inner-consciousness-work"], domains["spiritual-sacred"]
inner["name"] = "Inner / Consciousness & Sacred"
inner["description"] = (
    "The most intimate arena of regeneration and the infrastructure of belonging — together with the "
    "re-enchantment that underwrites it. Somatic healing, undoing the conditioning of separation, "
    "metabolizing inherited and collective trauma, and the perceptual shift from isolated self to "
    "interbeing; and, inseparable from these, the post-theological sacred — re-enchantment rooted in "
    "immanent embeddedness, Christ consciousness as collective emergence, devotion and surrender to "
    "evolutionary process, and the civilizational crisis reframed as a species-scale rite of passage. "
    "The inner work, the sacred, and the institutional work are one motion; consciousness change "
    "underwrites all structural change."
)
inner["sub_domains"] = uniq(inner.get("sub_domains", []) + sacred.get("sub_domains", []))
inner["sources"] = uniq(inner.get("sources", []) + sacred.get("sources", []))
del domains["spiritual-sacred"]

DOMAIN_REMAP = {"spiritual-sacred": "inner-consciousness-work"}

# ---- 2. gift merges ----
healer, caregiver = gifts["the-healer"], gifts["the-caregiver"]
healer["description"] = (
    "Extends Joe Lightfoot's Healer archetype, and gathers in the caregiver's tending. One who turns "
    "toward wounds with courage so trauma transforms into wisdom and the deepest hurts become the "
    "greatest capacity to serve — facilitating collective trauma release through truth-and-reconciliation, "
    "ceremony, and somatic practice, guiding people home to their bodies and to belonging with the Earth. "
    "This same gift carries the irreducibly relational labor of care: tending particular people in "
    "particular bonds, building material solidarity from named, reachable relationships, and sustaining "
    "the long unglamorous work of mutual aid that keeps neighbors fed, sheltered, and alive when "
    "institutions fail."
)
healer["shadow"] = (
    "Spiritual narcissism and consumer spirituality — the ego co-opting sacred language to sell peak "
    "experiences; spiritual bypass that treats wounds as transcended rather than witnessed and integrated; "
    "or fostering codependence rather than interdependence. In its caregiving face: bureaucratic abstraction "
    "that purchases distance from the people one claims to serve, performative solidarity, and volunteer "
    "burnout as scale outstrips real relationship."
)
for mod in ("western", "vedic", "human_design", "gene_keys"):
    healer["modality_signals"][mod] = uniq(
        healer["modality_signals"].get(mod, []) + caregiver["modality_signals"].get(mod, [])
    )[:6]
healer["sources"] = uniq(healer.get("sources", []) + caregiver.get("sources", []))

weaver, bridge = gifts["the-weaver"], gifts["the-bridgekeeper"]
weaver["description"] = (
    "Extends Joe Lightfoot's Weaver archetype. One who connects what has been isolated and shares what has "
    "been hoarded — federating cooperatives, bioregions, circles, and movements into self-reinforcing "
    "networks, practicing 'mycelial sensing' of the relationships and shared values within an ecology and "
    "making the connective tissue between projects explicit. Where weaving meets institutions, this gift "
    "also operates the interfaces between the dying world of empire and the emerging world of bioregional "
    "commons — running backbone institutions that hold legal standing yet deliberately bind their own power, "
    "brokering translation across worldviews while protecting each community's sovereignty, and practicing "
    "institutional self-negation: building bridges designed to be temporary."
)
weaver["shadow"] = (
    "Dissolving one's own differentiation into the network until one becomes a hidden hub the whole field "
    "depends on — recreating the parasitic centralization one set out to dissolve. Over-formalizing organic "
    "relationships or weaving so many threads it produces bureaucracy rather than belonging. In its "
    "institutional face: capture — accumulating durable power over the commons it was meant to serve, and "
    "imposing dominant categories that absorb diverse frameworks into a single ontology in the act of "
    "translation."
)
for mod in ("western", "vedic", "human_design", "gene_keys"):
    weaver["modality_signals"][mod] = uniq(
        weaver["modality_signals"].get(mod, []) + bridge["modality_signals"].get(mod, [])
    )[:6]
weaver["sources"] = uniq(weaver.get("sources", []) + bridge.get("sources", []))

del gifts["the-caregiver"]; del gifts["the-bridgekeeper"]
GIFT_REMAP = {"the-caregiver": "the-healer", "the-bridgekeeper": "the-weaver"}

# ---- remap trim-tabs, regenerate unique ids, keep all ----
seen_ids = collections.Counter()
new_trims = []
for t in fw["trim_tabs"]:
    t["gift_id"] = GIFT_REMAP.get(t["gift_id"], t["gift_id"])
    t["domain_id"] = DOMAIN_REMAP.get(t["domain_id"], t["domain_id"])
    base = f"tt-{t['gift_id']}-{t['domain_id']}"
    seen_ids[base] += 1
    t["id"] = base if seen_ids[base] == 1 else f"{base}-{seen_ids[base]}"
    new_trims.append(t)

# preserve declared order: domains then gifts as dicts->lists
fw["domains"] = list(domains.values())
fw["gifts"] = list(gifts.values())
fw["trim_tabs"] = new_trims

# ---- 3. modality_signals soft-prior note ----
fw["modality_signals_note"] = (
    "modality_signals are INTERPRETIVE HEURISTIC PRIORS, not empirically validated correspondences. "
    "They are inferred bridges to gently orient interpretation. The person's actual chart placements and "
    "their Ikigai reflection take precedence; never assert deterministic correspondence between a placement "
    "and a gift."
)

fw["framework_version"] = "1.1.0"
fw["changelog"] = (
    "1.1.0 (signoff pass 1): folded Spiritual/Sacred into Inner/Consciousness & Sacred (9->8 domains); "
    "merged Caregiver->Healer and Bridgekeeper->Weaver (14->12 gifts); reframed modality_signals as soft priors."
)

# ---- validate ----
gids = {g["id"] for g in fw["gifts"]}; dids = {d["id"] for d in fw["domains"]}
bad = [t["id"] for t in fw["trim_tabs"] if t["gift_id"] not in gids or t["domain_id"] not in dids]
dup = [i for i, n in collections.Counter(t["id"] for t in fw["trim_tabs"]).items() if n > 1]
assert not bad, f"dangling refs: {bad}"
assert not dup, f"duplicate trim-tab ids: {dup}"

json.dump(fw, open("framework/framework.json", "w"), indent=2, ensure_ascii=False)
print(f"v{fw['framework_version']}: {len(fw['domains'])} domains, {len(fw['gifts'])} gifts, {len(fw['trim_tabs'])} trim-tabs")
print("gifts:", sorted(gids))
print("domains:", sorted(dids))
print("dangling:", len(bad), "| dup ids:", len(dup))
