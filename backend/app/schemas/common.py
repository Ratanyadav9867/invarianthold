from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Auth schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# Failure Injection schema
class FailureInjectionRequest(BaseModel):
    component_ids: List[str]
    failure_type: str = "MANUAL_INJECTION"

# Traffic Simulation schema
class TrafficSimulateRequest(BaseModel):
    packet_count: int = Field(default=1000, ge=10, le=10000)

# Reroute schema
class RerouteRequest(BaseModel):
    path_id: Optional[str] = None  # If None, reroutes all affected paths

# Explain schema
class ExplainRequest(BaseModel):
    path_id: Optional[str] = None
    incident_id: Optional[str] = None
