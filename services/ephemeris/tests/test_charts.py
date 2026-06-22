"""Golden + IP-guard + self-consistency tests for the ephemeris service.

Run: cd services/ephemeris && . .venv/bin/activate && python -m pytest -q
(or: python -m unittest)

Reference subject: 1990-06-15 06:30 America/New_York, NYC (40.71, -74.01).
Astrology values are checked against Swiss-Ephemeris ground truth (sign-level,
which is stable across ephemerides). HD/Gene-Keys are checked for structural
validity + wheel-anchor correctness; exact gate/line golden values should be
locked against the Golden Calf reference once available.
"""
import json
import unittest

from fastapi.testclient import TestClient

from ephemeris.main import app
from ephemeris.human_design import gate_line, GATE_WHEEL, GATE_CENTER, CHANNELS

client = TestClient(app)

SUBJECT = {
    "name": "Ref", "year": 1990, "month": 6, "day": 15,
    "hour": 6, "minute": 30, "lat": 40.71, "lng": -74.01,
    "tz_str": "America/New_York", "unknown_time": False,
}


class TestWheelGeometry(unittest.TestCase):
    def test_gate_25_contains_0_aries(self):
        g, _ = gate_line(0.0)
        self.assertEqual(g, 25)

    def test_gate_41_at_2_aquarius(self):
        # 2 deg Aquarius = 302 deg ecliptic longitude
        g, line = gate_line(302.0 + 0.01)
        self.assertEqual(g, 41)
        self.assertEqual(line, 1)

    def test_wheel_complete(self):
        self.assertEqual(sorted(GATE_WHEEL), list(range(1, 65)))
        self.assertEqual(len(GATE_CENTER), 64)
        self.assertEqual(len(CHANNELS), 36)


class TestWestern(unittest.TestCase):
    def test_sun_in_gemini(self):
        r = client.post("/charts/western", json=SUBJECT)
        self.assertEqual(r.status_code, 200)
        data = r.json()["data"]
        self.assertEqual(data["positions"]["Sun"]["sign"], "Gemini")
        # Houses + ascendant present
        self.assertIn("ascendant", data["houses"])
        self.assertEqual(len(data["houses"]["cusps"]), 12)

    def test_engine_version_present(self):
        r = client.post("/charts/western", json=SUBJECT)
        self.assertIn("pyswisseph", r.json()["engine_version"])


class TestVedic(unittest.TestCase):
    def test_sidereal_differs_from_tropical(self):
        w = client.post("/charts/western", json=SUBJECT).json()["data"]
        v = client.post("/charts/vedic", json=SUBJECT).json()["data"]
        # Lahiri ayanamsa ~24 deg in 1990 -> sidereal Sun longitude lower
        self.assertIn("ayanamsa", v)
        self.assertGreater(v["ayanamsa"], 23.0)
        self.assertLess(v["ayanamsa"], 25.0)
        self.assertNotEqual(w["positions"]["Sun"]["lon"], v["positions"]["Sun"]["lon"])


class TestHumanDesign(unittest.TestCase):
    def test_structure(self):
        r = client.post("/charts/human-design", json=SUBJECT)
        self.assertEqual(r.status_code, 200)
        d = r.json()["data"]
        self.assertIn(d["type"], [
            "Generator", "Manifesting Generator", "Manifestor", "Projector", "Reflector",
        ])
        self.assertRegex(d["profile"], r"^[1-6]/[1-6]$")
        self.assertIn(d["authority"], [
            "Emotional", "Sacral", "Splenic", "Ego", "Self-Projected", "Mental", "Lunar",
        ])
        # personality + design each have 13 activations (incl Earth, South_Node)
        self.assertEqual(len(d["gates"]["personality"]), 13)
        self.assertEqual(len(d["gates"]["design"]), 13)
        # defined + open centers partition the 9 centers
        self.assertEqual(len(d["defined_centers"]) + len(d["open_centers"]), 9)

    def test_ip_guard_no_prose(self):
        """IP boundary: HD response must contain NO long descriptive prose fields."""
        d = client.post("/charts/human-design", json=SUBJECT).json()["data"]
        blob = json.dumps(d)
        # No field value should be a long descriptive sentence (proprietary text risk).
        def walk(x):
            if isinstance(x, str):
                # structural strings are short tokens; flag any long sentence-like value
                self.assertLess(len(x), 60, f"suspiciously long string: {x!r}")
            elif isinstance(x, dict):
                for v in x.values():
                    walk(v)
            elif isinstance(x, list):
                for v in x:
                    walk(v)
        walk(d)


class TestGeneKeys(unittest.TestCase):
    def test_activation_sequence(self):
        d = client.post("/charts/gene-keys", json=SUBJECT).json()["data"]
        seq = d["activation_sequence"]
        for sphere in ("lifes_work", "evolution", "radiance", "purpose"):
            self.assertIn(sphere, seq)
            self.assertIn(seq[sphere]["gate"], range(1, 65))
            self.assertIn(seq[sphere]["line"], range(1, 7))


class TestSynastry(unittest.TestCase):
    def test_cross_aspects(self):
        other = dict(SUBJECT, name="Other", year=1988, month=2, day=2)
        r = client.post("/charts/synastry", json={"a": SUBJECT, "b": other})
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.json()["aspects"], list)


class TestUnknownTime(unittest.TestCase):
    def test_flags_time_dependent(self):
        b = dict(SUBJECT, unknown_time=True)
        r = client.post("/charts/western", json=b)
        self.assertIn("ascendant", r.json()["time_dependent_fields"])
        hd = client.post("/charts/human-design", json=b).json()
        self.assertTrue(hd["data"]["low_confidence"])


if __name__ == "__main__":
    unittest.main()
