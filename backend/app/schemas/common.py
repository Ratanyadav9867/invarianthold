import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator

# Safe identifier regex: alphanumeric, dash, underscore only (prevents injection/traversal)
SAFE_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{1,100}$")

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
    user: Dict[str, Any]

class FailureInjectionRequest(BaseModel):
    component_ids: List[str] = Field(..., min_length=1, max_length=50)
    failure_type: str = Field(default="MANUAL_INJECTION", max_length=50)

    @field_validator("component_ids")
    @classmethod
    def validate_component_ids(cls, ids: List[str]) -> List[str]:
        if not ids:
            raise ValueError("Must provide at least one component ID.")
        for cid in ids:
            if not SAFE_ID_REGEX.match(cid):
                raise ValueError(f"Invalid component ID format: '{cid}'. Allowed: letters, digits, '-', '_'.")
        return ids

    @field_validator("failure_type")
    @classmethod
    def validate_failure_type(cls, v: str) -> str:
        allowed = {
            "MANUAL_INJECTION", "HARDWARE_FAULT", "LATENCY_SPIKE",
            "CONFIG_ERROR", "CORRUPTION", "CRASH", "BYPASS_ATTEMPT"
        }
        v = v.strip().upper()
        if v not in allowed:
            raise ValueError(f"Unknown failure_type '{v}'. Allowed types: {sorted(allowed)}")
        return v

class TrafficSimulateRequest(BaseModel):
    packet_count: int = Field(default=1000, ge=1, le=50000, description="Packet count between 1 and 50,000")

class RerouteRequest(BaseModel):
    path_id: Optional[str] = Field(default=None, max_length=100)

    @field_validator("path_id")
    @classmethod
    def validate_path_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not SAFE_ID_REGEX.match(v):
                raise ValueError(f"Invalid path ID format: '{v}'.")
        return v

class ExplainRequest(BaseModel):
    path_id: Optional[str] = Field(default=None, max_length=100)
    incident_id: Optional[str] = Field(default=None, max_length=100)

    @field_validator("path_id", "incident_id")
    @classmethod
    def validate_id_field(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not SAFE_ID_REGEX.match(v):
                raise ValueError("Invalid identifier format.")
        return v

class RiskAssessmentRequest(BaseModel):
    anomaly_score: float = Field(default=0.0, ge=0.0, le=100.0)

class PathVerificationRequest(BaseModel):
    source_node: str = Field(..., max_length=100)
    destination_node: str = Field(..., max_length=100)
    hops: List[str] = Field(..., min_length=2, max_length=50)

    @field_validator("source_node", "destination_node")
    @classmethod
    def validate_nodes(cls, v: str) -> str:
        if not SAFE_ID_REGEX.match(v):
            raise ValueError(f"Invalid node format: '{v}'.")
        return v

    @field_validator("hops")
    @classmethod
    def validate_hops(cls, hops: List[str]) -> List[str]:
        for h in hops:
            if not SAFE_ID_REGEX.match(h):
                raise ValueError(f"Invalid hop format: '{h}'.")
        return hops

