from typing import Any

from pydantic import BaseModel, Field, field_validator


# Auth schemas
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def clean_username(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Username cannot be empty or whitespace.")
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]

import re

SAFE_COMPONENT_ID_RE = re.compile(r"^[A-Za-z0-9_\-]+$")
ALLOWED_FAILURE_TYPES = {
    "MANUAL_INJECTION", "CRASH", "LATENCY", "BYPASS", "TAMPERING",
    "TIMEOUT", "CORRUPTION", "EXPLOIT", "DENIAL_OF_SERVICE", "CHAOS"
}

class FailureInjectionRequest(BaseModel):
    component_ids: list[str]
    failure_type: str = "MANUAL_INJECTION"

    @field_validator("component_ids")
    @classmethod
    def validate_component_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("component_ids list cannot be empty.")
        for cid in v:
            if not SAFE_COMPONENT_ID_RE.match(cid):
                raise ValueError(f"Invalid component ID format: '{cid}'")
        return v

    @field_validator("failure_type")
    @classmethod
    def validate_failure_type(cls, v: str) -> str:
        if v not in ALLOWED_FAILURE_TYPES:
            raise ValueError(f"Invalid failure type: '{v}'. Must be one of {sorted(ALLOWED_FAILURE_TYPES)}")
        return v

class TrafficSimulateRequest(BaseModel):
    packet_count: int = Field(default=1000, ge=1, le=50000, description="Packet count between 1 and 50,000")

class RerouteRequest(BaseModel):
    path_id: str | None = None  # If None, reroutes all affected paths

class ExplainRequest(BaseModel):
    path_id: str | None = None
    incident_id: str | None = None

# ── NEW: Feature schemas ──────────────────────────────────────────────────────

class SimulationCreateRequest(BaseModel):
    label: str = Field(default="What-If Simulation", max_length=128)

class SimulationScenarioRequest(BaseModel):
    simulation_id: str = Field(..., min_length=1, max_length=64)
    scenario_type: str = Field(..., max_length=64)
    targets: list[str] = Field(default_factory=list)
    latency_factor: float = Field(default=3.0, ge=1.0, le=100.0)
    packet_loss_pct: float = Field(default=10.0, ge=0.0, le=100.0)
    invariant_id: str | None = None

class SimulationRunRequest(BaseModel):
    simulation_id: str = Field(..., min_length=1, max_length=64)

class RecoveryModeRequest(BaseModel):
    mode: str = Field(..., pattern="^(MONITOR|RECOMMEND|AUTO)$")

class RecoveryExecuteRequest(BaseModel):
    path_id: str | None = None

class BlastRadiusRequest(BaseModel):
    component_ids: list[str] = Field(..., min_length=1)

class ChaosRunRequest(BaseModel):
    chaos_type: str = Field(..., max_length=64)
    components: list[str] = Field(default_factory=list)
    label: str = Field(default="", max_length=128)
    intensity: float = Field(default=1.0, ge=0.1, le=5.0)

class ChaosBatchRequest(BaseModel):
    test_type: str = Field(
        default="SINGLE",
        pattern="^(SINGLE|MULTI|RANDOM|PROGRESSIVE)$"
    )
    components: list[str] = Field(default_factory=list)
