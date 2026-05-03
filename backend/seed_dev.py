"""
Seed development database with one test school and super_admin user.
Run from ./backend with the virtualenv active:
    python seed_dev.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.school import School, SchoolType
from app.models.user import User, UserRole
from app.utils.security import hash_password

TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "TestPass123!"
TEST_SCHOOL = "Test School Lagos"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == TEST_EMAIL))
        if existing.scalar_one_or_none():
            print("[seed] Data already present — nothing to do.")
            return

        school = School(
            name=TEST_SCHOOL,
            school_type=SchoolType.secondary,
            address="14 Victoria Island Way, Lagos",
            lga="Eti-Osa",
            state="Lagos",
            phone="+2348012345678",
            email=TEST_EMAIL,
        )
        db.add(school)
        await db.flush()

        admin = User(
            school_id=school.id,
            name="Test Admin",
            email=TEST_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.super_admin,
            is_active=True,
            is_first_login=False,
        )
        db.add(admin)
        await db.commit()
        print("[seed] Test school and super_admin created.")


if __name__ == "__main__":
    asyncio.run(seed())
