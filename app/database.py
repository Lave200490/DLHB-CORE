from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# SQLite engine for local development; reconfigure the URL for production/postgres/etc.
DATABASE_URL = "sqlite:///./dlhb_core.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    """Yield a SQLAlchemy session for each request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
