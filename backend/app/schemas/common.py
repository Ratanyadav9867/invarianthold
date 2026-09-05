from typing import Any

from pydantic import BaseModel, Field


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

class FailureInjectionRequest(BaseModel):
    component_ids: list[str]
    failure_type: str = "MANUAL_INJECTION"

class TrafficSimulateRequest(BaseModel):
    packet_count: int = Field(default=1000, ge=1, le=50000, description="Packet count between 1 and 50,000")

class RerouteRequest(BaseModel):
    path_id: str | None = None  # If None, reroutes all affected paths

class ExplainRequest(BaseModel):
    path_id: str | None = None
    incident_id: str | None = None
