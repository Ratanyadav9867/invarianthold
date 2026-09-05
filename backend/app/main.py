import os
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.core.topology_seed import seed_database
from app.api.routes import router as api_router
from app.services.ml_engine import SKLEARN_AVAILABLE

logger = logging.getLogger("invarianthold")

# Ensure tables are created
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="InvariantHold API",
    description="Runtime Security Invariant Verification & Targeted Fail-Safe Platform",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 1. Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# 2. CORS: Explicit origin allow-list (never combine wildcard "*" with allow_credentials=True)
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# 3. Global Sanitized Error Handler (Prevents stack traces or DB details from leaking to clients)
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

# 4. Mount API routes
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
    """Public healthcheck probe for orchestrators and container healthchecks."""
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
