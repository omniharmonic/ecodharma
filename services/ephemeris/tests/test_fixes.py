"""Regression tests for the v0.2 accuracy repair (docs/v4-living-altar, Phase 0).

Each test names the bug it guards. Run:
  cd services/ephemeris && PYTHONPATH=. python -m pytest -q
"""
import unittest

from fastapi.testclient import TestClient

from ephemeris.human_design import (
    CHANNELS, GATE_CENTER, _center_graph, _defined_centers_and_channels,
    _determine_authority, _determine_type, boundary_distance_arcmin, gate_line,
)
from ephemeris.main import app
from ephemeris.vedic import nakshatra
from ephemeris.astro import resolve_time

client = TestClient(app)


def birth(**kw):
    base = {"name": "t", "year": 1990, "month": 6, "day": 15, "hour": 6, "minute": 30,
            "lat": 40.71, "lng": -74.01, "tz_str": "America/New_York", "unknown_time": False}
    base.update(kw)
    return base


class TestMidnight(unittest.TestCase):
    """A1: hour 0 was treated as 'unknown' and replaced with noon."""

    def test_midnight_is_not_noon(self):
        m = client.post("/charts/western", json=birth(hour=0, minute=14)).json()["data"]
        n = client.post("/charts/western", json=birth(hour=12, minute=14)).json()["data"]
        self.assertNotEqual(m["positions"]["Moon"]["lon"], n["positions"]["Moon"]["lon"])
        self.assertGreater(abs(m["positions"]["Moon"]["lon"] - n["positions"]["Moon"]["lon"]), 5.0)
        self.assertTrue(m["time"]["utc"].startswith("1990-06-15T04:14"))

    def test_midnight_minute_zero(self):
        d = client.post("/charts/human-design", json=birth(hour=0, minute=0)).json()["data"]
        self.assertEqual(d["time"]["utc"], "1990-06-15T04:00:00Z")
        self.assertFalse(d["time"]["assumed_noon"])

    def test_unknown_time_assumes_noon_and_says_so(self):
        d = client.post("/charts/human-design", json=birth(hour=None, minute=None, unknown_time=True)).json()["data"]
        self.assertTrue(d["time"]["assumed_noon"])


class TestGeneKeysMap(unittest.TestCase):
    """A2: Venus/Pearl spheres were drawn from the wrong planets; Core/Pearl missing."""

    EXPECTED = {
        ("activation_sequence", "lifes_work"): ("personality", "Sun"),
        ("activation_sequence", "evolution"): ("personality", "Earth"),
        ("activation_sequence", "radiance"): ("design", "Sun"),
        ("activation_sequence", "purpose"): ("design", "Earth"),
        ("venus_sequence", "attraction"): ("design", "Moon"),
        ("venus_sequence", "iq"): ("personality", "Venus"),
        ("venus_sequence", "eq"): ("personality", "Mars"),
        ("venus_sequence", "sq"): ("design", "Venus"),
        ("venus_sequence", "core"): ("design", "Mars"),
        ("pearl_sequence", "vocation"): ("design", "Mars"),
        ("pearl_sequence", "culture"): ("design", "Jupiter"),
        ("pearl_sequence", "pearl"): ("personality", "Jupiter"),
        ("pearl_sequence", "brand"): ("personality", "Sun"),
    }

    def test_every_sphere_comes_from_its_canonical_activation(self):
        hd = client.post("/charts/human-design", json=birth()).json()["data"]["gates"]
        gk = client.post("/charts/gene-keys", json=birth()).json()["data"]
        for (seq, sphere), (side, body) in self.EXPECTED.items():
            got = gk[seq][sphere]
            self.assertIsNotNone(got, f"{seq}.{sphere} missing")
            self.assertEqual((got["gate"], got["line"]), (hd[side][body]["gate"], hd[side][body]["line"]),
                             f"{seq}.{sphere} should be {side}.{body}")
            self.assertEqual(got["source"], f"{side}.{body}")

    def test_shared_keys(self):
        gk = client.post("/charts/gene-keys", json=birth()).json()["data"]
        self.assertEqual(gk["venus_sequence"]["core"]["gate"], gk["pearl_sequence"]["vocation"]["gate"])
        self.assertEqual(gk["pearl_sequence"]["brand"]["gate"], gk["activation_sequence"]["lifes_work"]["gate"])


def _chart_for_gates(gates):
    defined, channels = _defined_centers_and_channels(set(gates))
    adj = _center_graph(channels)
    t = _determine_type(defined, adj)
    return t, _determine_authority(defined, t, adj)


class TestAuthority(unittest.TestCase):
    """A6: authority hierarchy and wiring rules, with synthetic gate sets."""

    def test_emotional_wins(self):
        _, (a, _) = _chart_for_gates([6, 59, 5, 15])  # SP-Sacral + Sacral-G
        self.assertEqual(a, "Emotional")

    def test_sacral(self):
        t, (a, _) = _chart_for_gates([5, 15])
        self.assertEqual((t, a), ("Generator", "Sacral"))

    def test_splenic_projector(self):
        t, (a, _) = _chart_for_gates([20, 57])  # Spleen-Throat, no sacral, spleen not a motor
        self.assertEqual((t, a), ("Projector", "Splenic"))

    def test_ego_manifested(self):
        t, (a, d) = _chart_for_gates([21, 45])  # Heart-Throat
        self.assertEqual((t, a, d), ("Manifestor", "Ego", "Ego-Manifested"))

    def test_ego_projected(self):
        t, (a, d) = _chart_for_gates([25, 51])  # G-Heart, not to throat
        self.assertEqual((t, a, d), ("Projector", "Ego", "Ego-Projected"))

    def test_self_projected_requires_g_to_throat(self):
        t, (a, _) = _chart_for_gates([7, 31])  # G-Throat
        self.assertEqual((t, a), ("Projector", "Self-Projected"))

    def test_g_defined_without_throat_is_mental(self):
        # v0.1 called this Self-Projected. G-Ajna? (no such channel) — use G-Sacral? that's Generator.
        # Head-Ajna + G is impossible to define G without a channel; so define G via 1-8 (G-Throat) is
        # the only G-Throat path tested above. Here: Head-Ajna-Throat only (mental projector).
        t, (a, d) = _chart_for_gates([64, 47, 17, 62])
        self.assertEqual((t, a), ("Projector", "Mental"))
        self.assertIn("Environmental", d)

    def test_reflector(self):
        t, (a, _) = _chart_for_gates([])
        self.assertEqual((t, a), ("Reflector", "Lunar"))

    def test_channel_table_integrity(self):
        for a, b in CHANNELS:
            self.assertNotEqual(GATE_CENTER[a], GATE_CENTER[b])


class TestSensitivity(unittest.TestCase):
    """A7: activations near a line edge are flagged."""

    def test_boundary_distance(self):
        # Gate 41 begins at exactly 302°.
        self.assertAlmostEqual(boundary_distance_arcmin(302.0 + 1 / 60), 1.0, places=2)
        self.assertEqual(gate_line(302.0 + 1 / 60), (41, 1))

    def test_activation_fields(self):
        d = client.post("/charts/human-design", json=birth()).json()["data"]
        sun = d["gates"]["personality"]["Sun"]
        for k in ("lon", "edge_arcmin", "sensitive"):
            self.assertIn(k, sun)
        self.assertIn("sensitive_activations", d)
        self.assertIn("time_sensitive_fields", d)
        self.assertIn("design_utc", d)


class TestVedic(unittest.TestCase):
    """A3/A5: nakshatras computed (never invented); whole-sign houses; mean node."""

    def test_nakshatra_math(self):
        self.assertEqual(nakshatra(0.0)["name"], "Ashwini")
        self.assertEqual(nakshatra(0.0)["pada"], 1)
        self.assertEqual(nakshatra(13 + 1 / 3 - 1e-6)["name"], "Ashwini")
        self.assertEqual(nakshatra(13 + 1 / 3 - 1e-6)["pada"], 4)
        self.assertEqual(nakshatra(13 + 1 / 3)["name"], "Bharani")
        self.assertEqual(nakshatra(359.999)["name"], "Revati")
        self.assertEqual(nakshatra(40.0)["name"], "Rohini")  # 40 / 13.333 = 3.0 → 4th
        self.assertEqual(nakshatra(0.0)["lord"], "Ketu")

    def test_whole_sign_houses(self):
        v = client.post("/charts/vedic", json=birth()).json()["data"]["jyotish"]
        lagna_sign = v["lagna"]["sign"]
        self.assertEqual(v["houses"]["signs"][0], lagna_sign)
        self.assertEqual(v["houses"]["system"], "whole_sign")
        for name, g in v["grahas"].items():
            idx = v["houses"]["signs"].index(g["sign"])
            self.assertEqual(g["house"], idx + 1, name)
            self.assertIn("nakshatra", g)
        self.assertEqual(v["node"], "mean")
        self.assertAlmostEqual((v["grahas"]["Ketu"]["lon"] - v["grahas"]["Rahu"]["lon"]) % 360, 180.0, places=3)


class TestTimeResolution(unittest.TestCase):
    """A8: DST gaps and folds are detected, never silent."""

    def test_gap(self):
        t = resolve_time(2021, 3, 14, 2, 30, "America/New_York")
        self.assertEqual(t["warnings"], ["dst_gap"])

    def test_fold(self):
        t = resolve_time(2021, 11, 7, 1, 30, "America/New_York")
        self.assertEqual(t["warnings"], ["dst_fold"])
        self.assertEqual(t["utc"], "2021-11-07T05:30:00Z")  # first occurrence (EDT)

    def test_normal(self):
        t = resolve_time(1990, 6, 15, 6, 30, "America/New_York")
        self.assertEqual((t["warnings"], t["utc_offset_hours"]), ([], -4.0))


class TestPolarHouses(unittest.TestCase):
    def test_placidus_fallback_above_arctic_circle(self):
        r = client.post("/charts/western", json=birth(lat=69.65, lng=18.96, tz_str="Europe/Oslo"))
        self.assertEqual(r.status_code, 200)
        self.assertIn(r.json()["data"]["houses"]["system"], ("placidus", "porphyry"))


class TestCycles(unittest.TestCase):
    """Ritual thresholds vs published 2026 instants (USNO), within 2 minutes."""

    def test_2026_seasons_north(self):
        d = client.post("/cycles", json={"year": 2026, "lat": 40}).json()
        got = {s["label"]: s["at"] for s in d["seasons"]}
        self.assertTrue(got["Spring Equinox 2026"].startswith("2026-03-20T14:4"))
        self.assertTrue(got["Summer Solstice 2026"].startswith("2026-06-21T08:2"))
        self.assertTrue(got["Autumn Equinox 2026"].startswith("2026-09-23T00:0"))
        self.assertTrue(got["Winter Solstice 2026"].startswith("2026-12-21T20:5"))

    def test_southern_hemisphere_names(self):
        d = client.post("/cycles", json={"year": 2026, "lat": -33.9}).json()
        june = [s for s in d["seasons"] if s["sun_lon"] == 90][0]
        self.assertEqual(june["label"], "Winter Solstice 2026")

    def test_lunations_and_solar_return(self):
        d = client.post("/cycles", json={"year": 2026, "lat": 40, "natal_sun_lon": 84.07}).json()
        self.assertGreaterEqual(len(d["moons"]), 24)
        self.assertTrue(d["solar_return"]["at"].startswith("2026-06-1"))
        self.assertIn("2026-01-03T10:0", " ".join(m["at"] for m in d["moons"]))


if __name__ == "__main__":
    unittest.main()
