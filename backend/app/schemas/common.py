import re
from typing import Any

from pydantic import BaseModel, Field,field_validator

# Mirrors app.api.routes.SAFE_ID_REGEX: alphanumeric plus dash/underscore only.
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


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

ALLOWED_FAILURE_TYPES = {
    "MANUAL_INJECTION",
    "HARDWARE_FAULT",
    "PRIMARY_ENCRYPTION_FAIL",
    "SOFTWARE_CRASH",
    "NETWORK_PARTITION",
}


class FailureInjectionRequest(BaseModel):
    component_ids: list[str] = Field(..., min_length=1)
    failure_type: str = "MANUAL_INJECTION"

    @field_validator("failure_type")
    @classmethod
    def validate_failure_type(cls, v: str) -> str:
        if v not in ALLOWED_FAILURE_TYPES:
            raise ValueError(
                f"Invalid failure_type '{v}'. Must be one of {sorted(ALLOWED_FAILURE_TYPES)}."
            )
        return v

    @field_validator("component_ids")
    @classmethod
    def validate_component_ids(cls, v: list[str]) -> list[str]:
        for cid in v:
            if not _SAFE_ID_RE.match(cid):
                raise ValueError(
                    f"Invalid component ID '{cid}'. Only alphanumeric characters, "
                    "dashes, and underscores are allowed."
                )
        return v

class TrafficSimulateRequest(BaseModel):
    packet_count: int = Field(default=1000, ge=1, le=50000, description="Packet count between 1 and 50,000")

class RerouteRequest(BaseModel):
    path_id: str | None = None  # If None, reroutes all affected paths

class ExplainRequest(BaseModel):
    path_id: str | None = None
    incident_id: str | None = None
