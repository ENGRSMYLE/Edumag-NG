from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.guardian import GuardianProfile, StudentGuardian
from app.models.school_membership import MembershipRole, SchoolMembership
from app.models.student import Student
from tests.test_students import _auth, _register_school


async def test_bulk_upload_creates_and_reuses_guardian_after_commit(client, test_engine):
    school = await _register_school(client, email="bulk-guardian-admin@school.ng")
    rows = [
        {"first_name": "Ada", "last_name": "One", "date_of_birth": "2012-01-01", "gender": "female", "admission_date": "2024-09-01", "parent_name": "Grace One", "parent_email": "GRACE@example.com", "parent_phone": "08012345678", "relationship": "mother", "primary_guardian": "yes", "finance_access": "yes", "messaging_access": "yes"},
        {"first_name": "Ben", "last_name": "One", "date_of_birth": "2013-01-01", "gender": "male", "admission_date": "2024-09-01", "parent_name": "Grace One", "parent_email": "grace@example.com", "parent_phone": "+2348012345678", "relationship": "mother", "messaging_access": "yes"},
        {"first_name": "Bad", "last_name": "Guardian", "date_of_birth": "2013-01-01", "gender": "male", "admission_date": "2024-09-01", "parent_name": "Incomplete", "parent_email": "incomplete@example.com"},
    ]
    response = await client.post("/api/students/bulk-upload", json={"rows": rows}, headers=_auth(school["access_token"]))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success_count"] == 2
    assert len(body["error_rows"]) == 1
    assert body["guardian_links_created"] == 2
    assert body["pending_parent_invitations"] == 1
    assert body["invitations_dispatched"] == 0
    assert [item["status"] for item in body["row_results"]] == ["success", "success", "error"]

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        assert (await db.execute(select(func.count(Student.id)))).scalar_one() == 2
        assert (await db.execute(select(func.count(StudentGuardian.id)))).scalar_one() == 2
        assert (await db.execute(select(func.count(GuardianProfile.id)))).scalar_one() == 1
        assert (await db.execute(select(func.count(SchoolMembership.id)).where(SchoolMembership.role == MembershipRole.parent))).scalar_one() == 1
