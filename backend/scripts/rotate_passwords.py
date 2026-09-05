import sys

from app.config import settings
from app.core.security import get_password_hash
from app.database import SessionLocal
from app.models.auth import User

ROLE_TO_USERNAME = {
    "ADMIN": ("admin", settings.ADMIN_PASSWORD),
    "SECURITY_ANALYST": ("analyst", settings.ANALYST_PASSWORD),
    "VIEWER": ("viewer", settings.VIEWER_PASSWORD),
}

def main() -> int:
    db = SessionLocal()
    try:
        updated = []
        for role, (username, new_password) in ROLE_TO_USERNAME.items():
            if not new_password or new_password.startswith("CHANGE_ME"):
                print(f"[skip] no new password set for {username} ({role}).")
                continue
            user = db.query(User).filter(User.username == username).first()
            if not user:
                print(f"[warn] user '{username}' not found; skipping.")
                continue
            user.password_hash = get_password_hash(new_password)
            updated.append(username)
        if updated:
            db.commit()
            print(f"[ok] rotated password hash for: {', '.join(updated)}")
        else:
            print("[ok] nothing to update.")
        return 0
    finally:
        db.close()

if __name__ == "__main__":
    sys.exit(main())