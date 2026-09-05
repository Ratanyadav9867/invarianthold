import os
import secrets
import warnings
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "InvariantHold"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    ENV: str = "development"

    # SQLite Database
    DATABASE_URL: str = "sqlite:///./invarianthold.db"

    # Security & JWT
    # No hardcoded default: must come from the environment / .env file.
    # In development, if it's missing we generate a random one at process
    # startup (logging a warning) instead of falling back to a known,
    # publicly-committed string. In production this is a hard failure.
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # short-lived access token

    # CORS - comma-separated list of allowed origins, e.g.
    # "http://localhost:5173,https://app.example.com"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:8000"

    # Simulation defaults
    DEFAULT_PACKET_COUNT: int = 1000

    # Initial Demo Credentials — no defaults. Must be supplied via
    # environment/.env (which is gitignored) so no real or example
    # credential is ever committed to source control.
    ADMIN_USER: str = "admin@invarianthold.io"
    ADMIN_PASSWORD: Optional[str] = None
    ANALYST_USER: str = "analyst@invarianthold.io"
    ANALYST_PASSWORD: Optional[str] = None
    VIEWER_USER: str = "viewer@invarianthold.io"
    VIEWER_PASSWORD: Optional[str] = None

    model_config = {"env_file": ".env", "extra": "ignore"}

    @model_validator(mode="after")
    def _validate_secrets(self):
        if not self.SECRET_KEY:
            if self.ENV == "production":
                raise RuntimeError(
                    "SECRET_KEY is not set. Refusing to start in production "
                    "without an explicit JWT signing key. Set SECRET_KEY in "
                    "the environment (e.g. `openssl rand -hex 32`)."
                )
            warnings.warn(
                "SECRET_KEY not set — generating a random ephemeral key for "
                "this development process. Tokens will be invalid after "
                "restart. Set SECRET_KEY in .env to avoid this.",
                stacklevel=2,
            )
            self.SECRET_KEY = secrets.token_hex(32)

        missing_demo_pw = [
            name for name, val in [
                ("ADMIN_PASSWORD", self.ADMIN_PASSWORD),
                ("ANALYST_PASSWORD", self.ANALYST_PASSWORD),
                ("VIEWER_PASSWORD", self.VIEWER_PASSWORD),
            ] if not val
        ]
        if missing_demo_pw:
            if self.ENV == "production":
                raise RuntimeError(
                    f"Missing required credentials in production: {missing_demo_pw}. "
                    "Set them explicitly in the environment."
                )
            warnings.warn(
                f"{missing_demo_pw} not set — generating random demo passwords "
                "for this session. Check server startup logs for the values.",
                stacklevel=2,
            )
            if not self.ADMIN_PASSWORD:
                self.ADMIN_PASSWORD = secrets.token_urlsafe(12)
            if not self.ANALYST_PASSWORD:
                self.ANALYST_PASSWORD = secrets.token_urlsafe(12)
            if not self.VIEWER_PASSWORD:
                self.VIEWER_PASSWORD = secrets.token_urlsafe(12)
            print(
                "\n[InvariantHold] Generated demo credentials for this session "
                "(set these in .env to persist them):\n"
                f"  ADMIN_PASSWORD={self.ADMIN_PASSWORD}\n"
                f"  ANALYST_PASSWORD={self.ANALYST_PASSWORD}\n"
                f"  VIEWER_PASSWORD={self.VIEWER_PASSWORD}\n"
            )

        return self

settings = Settings()
