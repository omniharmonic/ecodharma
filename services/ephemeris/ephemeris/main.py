"""EcoDharma Ephemeris Service — FastAPI app.

POST /charts/western        -> tropical natal chart
POST /charts/vedic          -> sidereal (Lahiri) natal chart
POST /charts/human-design   -> bodygraph (type/profile/authority/centers/channels/gates)
POST /charts/gene-keys      -> core sequences (positions only)
POST /charts/synastry       -> cross-aspects between two charts
POST /cycles                -> ritual thresholds: equinoxes/solstices, lunations, solar return
GET  /healthz

Returns positions / structural facts only. No proprietary descriptive text.
Optional bearer-token auth via EPHEMERIS_TOKEN (skipped if unset, e.g. local dev).
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException

from . import __version__
from .astro import (
    BACKEND,
    aspects_within,
    cross_aspects,
    find_design_jd,
    houses,
    julday_ut,
    planet_longitudes,
    positions_payload,
    resolve_time,
)
from .cycles import jd_to_iso, thresholds
from .vedic import vedic_chart
from .gene_keys import gene_keys_sequences
from .human_design import human_design_chart
from .models import BirthData, ChartResponse, CyclesRequest, SynastryRequest, SynastryResponse

ENGINE = f"ecodharma-ephemeris-{__version__}+pyswisseph-{BACKEND}"
TIME_DEPENDENT = ["ascendant", "midheaven", "houses", "Moon"]

app = FastAPI(title="EcoDharma Ephemeris Service", version=__version__)


def require_token(authorization: Optional[str] = Header(default=None)) -> None:
    expected = os.environ.get("EPHEMERIS_TOKEN")
    if not expected:
        return  # auth disabled (local dev)
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="invalid or missing token")


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "engine": ENGINE}


def _hm(b: BirthData) -> tuple[int, int]:
    # Explicit None checks: hour 0 is MIDNIGHT, not "unknown". (v0.1 used
    # `b.hour or 12`, which silently turned every 00:xx birth into 12:xx.)
    if b.unknown_time or b.hour is None:
        return 12, 0
    return b.hour, b.minute if b.minute is not None else 0


def _birth_jd(b: BirthData, shift_minutes: float = 0.0) -> float:
    h, m = _hm(b)
    return julday_ut(b.year, b.month, b.day, h, m, b.tz_str) + shift_minutes / 1440.0


def _time_info(b: BirthData) -> dict:
    h, m = _hm(b)
    t = resolve_time(b.year, b.month, b.day, h, m, b.tz_str)
    return {"utc": t["utc"], "utc_offset_hours": t["utc_offset_hours"], "warnings": t["warnings"],
            "assumed_noon": bool(b.unknown_time or b.hour is None)}


SENSITIVITY_MINUTES = 10.0


def _natal(b: BirthData, sidereal: bool) -> dict:
    jd = _birth_jd(b)
    lons = planet_longitudes(jd, sidereal=sidereal)
    data = {
        "positions": positions_payload(lons),
        "houses": houses(jd, b.lat, b.lng, sidereal=sidereal),
        "aspects": aspects_within(lons),
    }
    if sidereal:
        import swisseph as swe
        data["ayanamsa"] = round(swe.get_ayanamsa_ut(jd), 6)
        data["jyotish"] = vedic_chart(jd, b.lat, b.lng)
    data["time"] = _time_info(b)
    if not b.unknown_time:
        data["time_sensitive_fields"] = _natal_time_sensitivity(b, sidereal, data)
    return data


def _natal_time_sensitivity(b: BirthData, sidereal: bool, base: dict) -> list[str]:
    """Fields that would change if the birth time were off by ±SENSITIVITY_MINUTES."""
    changed: set[str] = set()
    for shift in (-SENSITIVITY_MINUTES, SENSITIVITY_MINUTES):
        jd = _birth_jd(b, shift)
        h = houses(jd, b.lat, b.lng, sidereal=sidereal)
        if h["ascendant"]["sign"] != base["houses"]["ascendant"]["sign"]:
            changed.add("ascendant.sign")
        if h["midheaven"]["sign"] != base["houses"]["midheaven"]["sign"]:
            changed.add("midheaven.sign")
        moon = positions_payload(planet_longitudes(jd, sidereal=sidereal))["Moon"]["sign"]
        if moon != base["positions"]["Moon"]["sign"]:
            changed.add("Moon.sign")
        if sidereal:
            vj = vedic_chart(jd, b.lat, b.lng)
            if vj["lagna"]["sign"] != base["jyotish"]["lagna"]["sign"]:
                changed.add("lagna.sign")
            if vj["grahas"]["Moon"]["nakshatra"]["name"] != base["jyotish"]["grahas"]["Moon"]["nakshatra"]["name"]:
                changed.add("Moon.nakshatra")
    return sorted(changed)


@app.post("/charts/western", response_model=ChartResponse, dependencies=[Depends(require_token)])
def western(b: BirthData) -> ChartResponse:
    return ChartResponse(
        modality="western", engine_version=ENGINE,
        time_dependent_fields=TIME_DEPENDENT if b.unknown_time else [],
        data=_natal(b, sidereal=False),
    )


@app.post("/charts/vedic", response_model=ChartResponse, dependencies=[Depends(require_token)])
def vedic(b: BirthData) -> ChartResponse:
    return ChartResponse(
        modality="vedic", engine_version=ENGINE,
        time_dependent_fields=TIME_DEPENDENT if b.unknown_time else [],
        data=_natal(b, sidereal=True),
    )


def _hd_longitudes(b: BirthData, shift_minutes: float = 0.0) -> tuple[dict, dict]:
    """Personality (birth) and design (88deg solar arc before) longitude dicts,
    each extended with Earth (Sun+180) and South_Node already present."""
    p_jd = _birth_jd(b, shift_minutes)
    d_jd = find_design_jd(p_jd)
    p = planet_longitudes(p_jd, sidereal=False)
    d = planet_longitudes(d_jd, sidereal=False)
    for lons in (p, d):
        lons["Earth"] = (lons["Sun"] + 180.0) % 360.0
    return p, d


def _hd_signature(chart: dict) -> dict:
    acts = {f"{side}.{body}": (a["gate"], a["line"])
            for side in ("personality", "design") for body, a in chart["gates"][side].items()}
    return {"type": chart["type"], "authority": chart["authority"], "profile": chart["profile"],
            "definition": chart["definition"],
            "channels": sorted("-".join(map(str, c["gates"])) for c in chart["channels"]), "acts": acts}


def _hd_time_sensitivity(b: BirthData, chart: dict) -> list[str]:
    base = _hd_signature(chart)
    changed: set[str] = set()
    for shift in (-SENSITIVITY_MINUTES, SENSITIVITY_MINUTES):
        p, d = _hd_longitudes(b, shift)
        alt = _hd_signature(human_design_chart(p, d, unknown_time=False))
        for k in ("type", "authority", "profile", "definition", "channels"):
            if alt[k] != base[k]:
                changed.add(k)
        for k, v in alt["acts"].items():
            if v != base["acts"].get(k):
                changed.add(k)
    return sorted(changed)


@app.post("/charts/human-design", response_model=ChartResponse, dependencies=[Depends(require_token)])
def human_design(b: BirthData) -> ChartResponse:
    p, d = _hd_longitudes(b)
    chart = human_design_chart(p, d, unknown_time=b.unknown_time)
    chart["time"] = _time_info(b)
    chart["design_utc"] = jd_to_iso(find_design_jd(_birth_jd(b)))
    if not b.unknown_time:
        chart["time_sensitive_fields"] = _hd_time_sensitivity(b, chart)
    return ChartResponse(
        modality="human_design", engine_version=ENGINE,
        time_dependent_fields=(["type", "profile", "authority", "centers", "channels", "gates"]
                               if b.unknown_time else []),
        data=chart,
    )


@app.post("/charts/gene-keys", response_model=ChartResponse, dependencies=[Depends(require_token)])
def gene_keys(b: BirthData) -> ChartResponse:
    p, d = _hd_longitudes(b)
    chart = human_design_chart(p, d, unknown_time=b.unknown_time)
    seq = gene_keys_sequences(chart["gates"]["personality"], chart["gates"]["design"])
    return ChartResponse(
        modality="gene_keys", engine_version=ENGINE,
        time_dependent_fields=(["activation_sequence", "venus_sequence", "pearl_sequence"]
                               if b.unknown_time else []),
        data=seq,
    )


@app.post("/cycles", dependencies=[Depends(require_token)])
def cycles(req: CyclesRequest) -> dict:
    return {"engine_version": ENGINE, **thresholds(req.year, req.lat, req.natal_sun_lon)}


@app.post("/charts/synastry", response_model=SynastryResponse, dependencies=[Depends(require_token)])
def synastry(req: SynastryRequest) -> SynastryResponse:
    la = planet_longitudes(_birth_jd(req.a), sidereal=False)
    lb = planet_longitudes(_birth_jd(req.b), sidereal=False)
    return SynastryResponse(engine_version=ENGINE, aspects=cross_aspects(la, lb))
