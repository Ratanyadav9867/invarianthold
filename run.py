import sys
import os
import uvicorn

# Ensure backend directory is in Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from app.main import app
from app.config import settings

def main():
    print("=" * 70)
    print("  INVARIANTHOLD — RUNTIME SECURITY INVARIANT VERIFICATION PLATFORM")
    print("=" * 70)
    print("  [>] Local SOC Dashboard:  http://localhost:8000")
    print("  [>] REST API Docs:        http://localhost:8000/docs")
    print("  [>] Health Check:         http://localhost:8000/health")
    print("-" * 70)
    if settings.ENV != "production":
        # Only echo credentials in non-production runs, and always read them
        # from the actually-configured settings (never hardcode them here) so
        # this can't drift from what's really seeded into the database.
        print("  Demo Credentials (RBAC) — set via .env, generated if absent:")
        print(f"    * ADMIN:    {settings.ADMIN_USER}   / {settings.ADMIN_PASSWORD}")
        print(f"    * ANALYST:  {settings.ANALYST_USER} / {settings.ANALYST_PASSWORD}")
        print(f"    * VIEWER:   {settings.VIEWER_USER}  / {settings.VIEWER_PASSWORD}")
        print("=" * 70)
    print("  Starting InvariantHold Unified Server on http://0.0.0.0:8000 ...")
    print("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

if __name__ == "__main__":
    main()
