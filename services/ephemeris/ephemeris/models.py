"""Pydantic contracts for the ephemeris service."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BirthData(BaseModel):
    name: str = "Subject"
    year: int
    month: int
    day: int
    hour: Optional[int] = None
    minute: Optional[int] = None
    lat: float
    lng: float
    tz_str: str = "UTC"
    unknown_time: bool = False


class ChartResponse(BaseModel):
    modality: str
    engine_version: str
    time_dependent_fields: list[str] = Field(default_factory=list)
    data: dict


class SynastryRequest(BaseModel):
    a: BirthData
    b: BirthData


class SynastryResponse(BaseModel):
    engine_version: str
    aspects: list[dict]
