"""Ritual thresholds — the exact moments the Living Altar's ceremonial calendar
turns on: equinoxes & solstices (named by the person's hemisphere), new & full
moons, and the solar return. All solved by bracketing + bisection on the same
ephemeris as the charts, to well under a second.
"""
from __future__ import annotations

from datetime import datetime, timezone

import swisseph as swe

from .astro import moon_longitude, sun_longitude

SEASONS_N = {0: "Spring Equinox", 90: "Summer Solstice", 180: "Autumn Equinox", 270: "Winter Solstice"}
SEASONS_S = {0: "Autumn Equinox", 90: "Winter Solstice", 180: "Spring Equinox", 270: "Summer Solstice"}


def _signed(x: float) -> float:
    return ((x + 180.0) % 360.0) - 180.0


def _bisect(f, a: float, b: float, iters: int = 60) -> float:
    fa = f(a)
    for _ in range(iters):
        m = (a + b) / 2.0
        fm = f(m)
        if (fa <= 0) == (fm <= 0):
            a, fa = m, fm
        else:
            b = m
    return (a + b) / 2.0


def _find_crossings(f, jd0: float, jd1: float, step: float) -> list[float]:
    """Roots of f where f goes from negative to positive (f is a signed angle)."""
    out = []
    a, fa = jd0, f(jd0)
    while a < jd1:
        b = min(a + step, jd1)
        fb = f(b)
        # A true crossing is a small negative→positive step (not the ±180° wrap).
        if fa < 0 <= fb and (fb - fa) < 90:
            out.append(_bisect(f, a, b))
        a, fa = b, fb
    return out


def jd_to_iso(jd: float) -> str:
    y, m, d, h = swe.revjul(jd)
    secs = round(h * 3600.0)
    dt = datetime(y, m, d, tzinfo=timezone.utc).timestamp() + secs
    return datetime.fromtimestamp(dt, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def thresholds(year: int, lat: float, natal_sun_lon: float | None = None) -> dict:
    jd0 = swe.julday(year, 1, 1, 0.0)
    jd1 = swe.julday(year + 1, 1, 1, 0.0)
    names = SEASONS_N if lat >= 0 else SEASONS_S
    seasons = []
    for target, label in names.items():
        for jd in _find_crossings(lambda j, t=target: _signed(sun_longitude(j) - t), jd0, jd1, 5.0):
            seasons.append({"kind": "season", "sun_lon": target, "label": f"{label} {year}", "at": jd_to_iso(jd)})
    seasons.sort(key=lambda x: x["at"])

    elong = lambda j: _signed(moon_longitude(j) - sun_longitude(j))
    full = lambda j: _signed(moon_longitude(j) - sun_longitude(j) - 180.0)
    moons = [{"kind": "new_moon", "label": "New Moon", "at": jd_to_iso(j)} for j in _find_crossings(elong, jd0, jd1, 1.0)]
    moons += [{"kind": "full_moon", "label": "Full Moon", "at": jd_to_iso(j)} for j in _find_crossings(full, jd0, jd1, 1.0)]
    moons.sort(key=lambda x: x["at"])

    out = {"year": year, "hemisphere": "N" if lat >= 0 else "S", "seasons": seasons, "moons": moons}
    if natal_sun_lon is not None:
        sr = _find_crossings(lambda j: _signed(sun_longitude(j) - natal_sun_lon), jd0, jd1, 5.0)
        out["solar_return"] = {"kind": "solar_return", "label": f"Solar Return {year}", "at": jd_to_iso(sr[0])} if sr else None
    return out
