"""EcoDharma Ephemeris Service — FastAPI app.

POST /charts/western        -> tropical natal chart
POST /charts/vedic          -> sidereal (Lahiri) natal chart
POST /charts/human-design   -> bodygraph (type/profile/authority/centers/channels/gates)
POST /charts/gene-keys      -> core sequences (positions only)
POST /charts/synastry       -> cross-aspects between two charts
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
    aspects_within,
    cross_aspects,
    find_design_jd,
    houses,
    julday_ut,
    planet_longitudes,
    positions_payload,
)
from .gene_keys import gene_keys_sequences
from .human_design import human_design_chart
from .models import BirthData, ChartResponse, SynastryRequest, SynastryResponse

ENGINE = f"ecodharma-ephemeris-{__version__}+pyswisseph-moshier"
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


def _birth_jd(b: BirthData) -> float:
    return julday_ut(b.year, b.month, b.day, b.hour or 12, b.minute or 0, b.tz_str)


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
    return data


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


def _hd_longitudes(b: BirthData) -> tuple[dict, dict]:
    """Personality (birth) and design (88deg solar arc before) longitude dicts,
    each extended with Earth (Sun+180) and South_Node already present."""
    p_jd = _birth_jd(b)
    d_jd = find_design_jd(p_jd)
    p = planet_longitudes(p_jd, sidereal=False)
    d = planet_longitudes(d_jd, sidereal=False)
    for lons in (p, d):
        lons["Earth"] = (lons["Sun"] + 180.0) % 360.0
    return p, d


@app.post("/charts/human-design", response_model=ChartResponse, dependencies=[Depends(require_token)])
def human_design(b: BirthData) -> ChartResponse:
    p, d = _hd_longitudes(b)
    chart = human_design_chart(p, d, unknown_time=b.unknown_time)
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


@app.post("/charts/synastry", response_model=SynastryResponse, dependencies=[Depends(require_token)])
def synastry(req: SynastryRequest) -> SynastryResponse:
    la = planet_longitudes(_birth_jd(req.a), sidereal=False)
    lb = planet_longitudes(_birth_jd(req.b), sidereal=False)
    return SynastryResponse(engine_version=ENGINE, aspects=cross_aspects(la, lb))
