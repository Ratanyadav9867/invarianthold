import datetime
import time
from typing import Any,Dict,List

import bcrypt
import jwt
from app.config import settings
from jwt import PyJWTError


# In-memory failed login tracking for brute-force defense
_failed_login_attempts: Dict[str, List[float]] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 60.0

def record_failed_login(identifier: str):
    now = time.time()
    attempts = _failed_login_attempts.get(identifier, [])
    attempts = [t for t in attempts if now - t < LOCKOUT_DURATION_SECONDS]
    attempts.append(now)
    _failed_login_attempts[identifier] = attempts

def clear_failed_logins(identifier: str):
    _failed_login_attempts.pop(identifier, None)

def is_login_locked(identifier: str) -> bool:
    now = time.time()
    attempts = _failed_login_attempts.get(identifier, [])
    attempts = [t for t in attempts if now - t < LOCKOUT_DURATION_SECONDS]
    _failed_login_attempts[identifier] = attempts
    return len(attempts) >= MAX_FAILED_ATTEMPTS

def validate_password_strength(password: str) -> bool:
    """Validate password satisfies minimum security requirements."""
    if not password or len(password) < 8 or len(password) > 128:
        return False
    return True

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def create_access_token(data: dict[str, Any], expires_delta: datetime.timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.UTC) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        unverified_headers = jwt.get_unverified_header(token)
        if unverified_headers.get("alg", "").lower() in ["none", ""]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsigned or insecure algorithm rejected.",
                headers={"WWW-Authenticate": "Bearer"}
            )
    except HTTPException:
        raise
    except (PyJWTError, ValueError):
        # Header cannot be parsed; jwt.decode will raise explicit DecodeError below
        pass  # nosec B110

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_signature": True, "verify_exp": True}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except (jwt.InvalidTokenError, jwt.DecodeError, PyJWTError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

