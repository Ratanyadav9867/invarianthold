import sys
import os
import uvicorn

# Ensure backend directory is in Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from app.main import app

def main():
    print("=" * 70)
    print("  INVARIANTHOLD — RUNTIME SECURITY INVARIANT VERIFICATION PLATFORM")
    print("=" * 70)
    print("  [>] Local SOC Dashboard:  http://localhost:8000")
    print("  [>] REST API Docs:        http://localhost:8000/docs")
    print("  [>] Health Check:         http://localhost:8000/health")
    print("-" * 70)
    print("  Default Demo Credentials (RBAC):")
    print("    * ADMIN:    admin@invarianthold.io   / REDACTED_PASSWORD")
    print("    * ANALYST:  analyst@invarianthold.io / REDACTED_PASSWORD")
    print("    * VIEWER:   viewer@invarianthold.io  / REDACTED_PASSWORD")
    print("=" * 70)
    print("  Starting InvariantHold Unified Server on http://0.0.0.0:8000 ...")
    print("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

if __name__ == "__main__":
    main()
