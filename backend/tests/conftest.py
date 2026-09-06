import os
import pytest
from sqlalchemy.pool import StaticPool
from app.core.topology_seed import seed_database
from app.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# Enable CSRF bypass for the test suite (TestClient cannot share cookies across threads)
os.environ.setdefault("TESTING", "true")

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh in-memory SQLite database for each test function."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    
    # Seed default fintech topology
    seed_database(session, reset=True)
    
    yield session
    
    session.close()
    Base.metadata.drop_all(bind=test_engine)

