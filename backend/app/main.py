import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.core.topology_seed import seed_database
from app.api.routes import router as api_router
from app.services.ml_engine import SKLEARN_AVAILABLE

# Ensure tables are created
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="InvariantHold API",
    description="Runtime Security Invariant Verification & Targeted Fail-Safe Platform",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
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

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_database(db, reset=False)
    finally:
        db.close()

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": "CONNECTED",
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
