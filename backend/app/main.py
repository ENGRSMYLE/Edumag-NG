import asyncio
import logging
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

import os
from fastapi import FastAPI, Request, status, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import students as students_router
from app.routers import classes as classes_router
from app.routers import parents as parents_router
from app.routers import attendance as attendance_router
from app.routers import results as results_router
from app.routers import finance as finance_router
from app.routers import assignments as assignments_router
from app.routers import communication as communication_router
from app.routers import dashboard as dashboard_router
from app.routers import settings as settings_router
from app.utils.rate_limit import limiter  # single shared limiter instance

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EduMag NG API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Attach limiter to app state so slowapi middleware can find it
app.state.limiter = limiter

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_cors_origins = [o.strip() for o in settings.FRONTEND_URL.split(",") if o.strip()]

# In development allow any localhost port so the Next.js dev server can run on
# 3000, 3001, etc. without breaking the cookie/CORS flow.
_cors_kwargs: dict = dict(
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if settings.is_production:
    _cors_kwargs["allow_origins"] = _cors_origins
else:
    _cors_kwargs["allow_origin_regex"] = r"http://localhost(:\d+)?"

app.add_middleware(CORSMiddleware, **_cors_kwargs)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router.router, prefix="/api")
app.include_router(users_router.router, prefix="/api")
app.include_router(students_router.router, prefix="/api")
app.include_router(classes_router.router, prefix="/api")
app.include_router(parents_router.router, prefix="/api")
app.include_router(attendance_router.router, prefix="/api")
app.include_router(results_router.router, prefix="/api")
app.include_router(finance_router.router, prefix="/api")
app.include_router(assignments_router.router, prefix="/api")
app.include_router(communication_router.router, prefix="/api")
app.include_router(dashboard_router.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup() -> None:
    logger.info(
        "EduMag NG API starting — environment=%s", settings.ENVIRONMENT
    )


# ---------------------------------------------------------------------------
# TEMPORARY — delete after use
# ---------------------------------------------------------------------------
_TRUNCATE_SECRET = os.environ.get("TRUNCATE_SECRET", "")

@app.post("/admin/truncate-db")
async def truncate_db(x_truncate_secret: str = Header(...)):
    if not _TRUNCATE_SECRET or x_truncate_secret != _TRUNCATE_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    from sqlalchemy import text
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        )
        tables = [row[0] for row in result.fetchall()]
        names = ", ".join(f'"{t}"' for t in tables)
        await session.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
        await session.commit()
    logger.warning("DATABASE TRUNCATED via /admin/truncate-db")
    return {"truncated": tables}
