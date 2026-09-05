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

# CORS: explicit origin allow-list (never combine wildcard "*" with
# allow_credentials=True — that reflects any origin back with credentials
# enabled, which defeats the purpose of an allow-list).
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
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
