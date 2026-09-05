import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "InvariantHold"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    ENV: str = "development"
    
    # SQLite Database
    DATABASE_URL: str = "sqlite:///./invarianthold.db"
    
    # Security & JWT
    SECRET_KEY: str = "REDACTED_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Simulation defaults
    DEFAULT_PACKET_COUNT: int = 1000
    
    # Initial Demo Credentials (Hashed into DB on first seed)
    ADMIN_USER: str = "admin@invarianthold.io"
    ADMIN_PASSWORD: str = "REDACTED_PASSWORD"
    ANALYST_USER: str = "analyst@invarianthold.io"
    ANALYST_PASSWORD: str = "REDACTED_PASSWORD"
    VIEWER_USER: str = "viewer@invarianthold.io"
    VIEWER_PASSWORD: str = "REDACTED_PASSWORD"
    
    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
