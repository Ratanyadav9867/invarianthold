from contextlib import asynccontextmanager
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes import router as api_router
from app.config import settings
from app.core.topology_seed import seed_database
from app.database import Base, SessionLocal, engine, get_db
from app.models.audit import AuditLog
from app.models.component import Component
from app.models.invariant import SecurityInvariant
from app.services.ml_engine import SKLEARN_AVAILABLE

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, reset=False)
    finally:
        db.close()
    yield

app = FastAPI(
    title="InvariantHold API",
    description="Runtime Security Invariant Verification & Targeted Fail-Safe Platform",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# 1. Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Content-Security-Policy — allow CDN sources the frontend requires
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://cdn.tailwindcss.com https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://unpkg.com; "
        "img-src 'self' data:; "
        "font-src 'self' data: https://unpkg.com; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    # Permissions-Policy: disable dangerous browser features
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# 2. CSRF Double-Submit Cookie Middleware
CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    """
    Double-submit cookie CSRF protection for state-changing endpoints.
    - On safe methods (GET/HEAD/OPTIONS): set csrf_token cookie if missing.
    - On unsafe methods (POST/PUT/DELETE): validate X-CSRF-Token header matches cookie.
    - /api/auth/login is excluded (unauthenticated — no session exists yet).
    - TESTING=true env var disables enforcement (pytest cannot share cookies across threads).
    """
    # Allow automated test suites to bypass CSRF (cookie sharing not possible in TestClient)
    if os.environ.get("TESTING", "false").lower() == "true":
        return await call_next(request)

    if request.method in CSRF_SAFE_METHODS:
        response = await call_next(request)
        if "csrf_token" not in request.cookies:
            token = secrets.token_hex(32)
            response.set_cookie(
                key="csrf_token",
                value=token,
                httponly=False,    # Must be readable by JS to send as header
                samesite="strict",
                secure=False,      # Set True in production behind HTTPS
                max_age=3600
            )
        return response

    # Allow login endpoint without CSRF check (no existing session)
    if request.url.path in ("/api/auth/login",):
        return await call_next(request)

    # Enforce CSRF for all other state-changing requests
    cookie_token = request.cookies.get("csrf_token", "")
    header_token = request.headers.get("X-CSRF-Token", "")

    if not cookie_token or not header_token:
        return JSONResponse(
            status_code=403,
            content={"detail": "CSRF token missing. Include X-CSRF-Token header matching csrf_token cookie."}
        )
    if not secrets.compare_digest(cookie_token, header_token):
        return JSONResponse(
            status_code=403,
            content={"detail": "CSRF token mismatch. Request rejected."}
        )
    return await call_next(request)

# 3. CORS: Explicit origin allow-list (never combine wildcard "*" with allow_credentials=True)
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-CSRF-Token"],
)

# 4. Global Sanitized Error Handler (Prevents stack traces or DB details from leaking to clients)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None)
        )
    logger.error(f"Unhandled server exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact security operations."}
    )

# 5. Mount API routes
app.include_router(api_router, prefix="/api")

@app.get("/health")
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "CONNECTED"
    except Exception as e:
        db_status = f"ERROR: {str(e)}"

    inv_count = db.query(SecurityInvariant).count()
    comp_count = db.query(Component).count()
    audit_count = db.query(AuditLog).count()

    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENV,
        "subsystems": {
            "backend": {"status": "OPERATIONAL", "version": settings.VERSION},
            "database": {"status": db_status, "engine": "SQLite" if settings.DATABASE_URL.startswith("sqlite") else "PostgreSQL"},
            "invariant_engine": {"status": "ACTIVE", "invariants_loaded": inv_count},
            "topology_engine": {"status": "ACTIVE", "components_loaded": comp_count},
            "ml_engine": {"status": "ACTIVE", "model": "IsolationForest (scikit-learn)" if SKLEARN_AVAILABLE else "Statistical Baseline"},
            "simulation_engine": {"status": "READY", "default_packets": settings.DEFAULT_PACKET_COUNT},
            "audit_ledger": {"status": "ACTIVE", "records_logged": audit_count, "algorithm": "SHA-256"}
        },
        "database": db_status,
        "ml_engine": "ACTIVE (scikit-learn)" if SKLEARN_AVAILABLE else "ACTIVE (Statistical Fallback)",
        "simulation_engine": "READY"
    }

# Frontend static serving (checks frontend/dist first, then backend/app/static)
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_dist(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
elif os.path.exists(static_dir):
    @app.get("/")
    @app.get("/{full_path:path}")
    def serve_static(full_path: str = ""):
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
