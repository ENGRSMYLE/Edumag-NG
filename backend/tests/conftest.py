# Set all required environment variables BEFORE any app module is imported.
import os

os.environ.setdefault(
    "DATABASE_URL",
    os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/edumag_test",
    ),
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only-exactly-48ch!!")
os.environ.setdefault("RESEND_API_KEY", "re_test_placeholder")
os.environ.setdefault("FROM_EMAIL", "test@edumag.com")
os.environ.setdefault("PAYSTACK_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("PAYSTACK_PUBLIC_KEY", "pk_test_placeholder")
os.environ.setdefault("CLOUDINARY_CLOUD_NAME", "test")
os.environ.setdefault("CLOUDINARY_API_KEY", "000000000000000")
os.environ.setdefault("CLOUDINARY_API_SECRET", "test_secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("ENVIRONMENT", "test")

from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# App imports AFTER env vars are set
from app.database import Base, get_db
from app.main import app

_TEST_DB_URL = os.environ["DATABASE_URL"]

# ---------------------------------------------------------------------------
# Session-scoped engine — creates schema once per test run.
# NullPool prevents asyncpg connections from being reused across event loops.
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(_TEST_DB_URL, echo=False, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ---------------------------------------------------------------------------
# Function-scoped client — truncates data between tests, each request gets
# its own fresh session so there are no shared-connection loop mismatches.
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    # Clean slate for this test
    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())

    _factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async def _override_get_db():
        async with _factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Reusable helpers
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def registered_school(client: AsyncClient) -> dict:
    """Register a school and return the full JSON response body."""
    resp = await client.post(
        "/api/auth/register-school",
        json={
            "school_name": "Test Academy",
            "school_type": "secondary",
            "address": "1 Test Street",
            "lga": "Ikeja",
            "state": "Lagos",
            "phone": "08012345678",
            "admin_name": "Admin User",
            "email": "admin@testacademy.com",
            "password": "Password1",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest_asyncio.fixture
async def auth_headers(registered_school: dict, client: AsyncClient) -> dict:
    """Return Authorization header for the registered super_admin."""
    token = registered_school["access_token"]
    return {"Authorization": f"Bearer {token}"}
