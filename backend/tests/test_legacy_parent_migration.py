from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.guardian import StudentGuardian
from app.models.parent import Parent, ParentRelationship
from app.services.legacy_parent_migration import audit_legacy_parents, backfill_safe_legacy_parents, verify_legacy_parent_backfill
from tests.test_parent_authorization import _seed_parent_access


async def test_audit_and_idempotent_safe_backfill(client, test_engine):
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        context, _, _, students, _ = await _seed_parent_access(db)
        db.add_all([
            Parent(school_id=context.school_id, student_id=students[0].id, name="Safe Guardian", relation_type=ParentRelationship.mother, email="SAFE@Example.com", phone="08012345678"),
            Parent(school_id=context.school_id, student_id=students[1].id, name="Safe Guardian", relation_type=ParentRelationship.mother, email="safe@example.com", phone="+2348012345678"),
            Parent(school_id=context.school_id, student_id=students[0].id, name="Missing Email", relation_type=ParentRelationship.other, email=None, phone="08099999999"),
            Parent(school_id=context.school_id, student_id=students[1].id, name="Invalid", relation_type=ParentRelationship.guardian, email="not-an-email", phone="bad"),
        ])
        await db.commit()

        report = await audit_legacy_parents(db, context.school_id)
        assert report.legacy_count == 4
        assert len(report.safe_groups) == 1
        assert len(report.duplicate_emails) == 1
        assert len(report.missing_emails) == 1
        assert len(report.invalid_contact_data) == 1

        first = await backfill_safe_legacy_parents(db, context.school_id, context.user.id)
        second = await backfill_safe_legacy_parents(db, context.school_id, context.user.id)
        assert first["created_relationships"] == 2
        assert second["created_relationships"] == 0
        links = list((await db.execute(select(StudentGuardian).where(StudentGuardian.school_id == context.school_id))).scalars().all())
        assert len(links) == 4  # two authorization fixtures plus two migrated links
        verification = await verify_legacy_parent_backfill(db, context.school_id)
        assert verification["legacy_parent_rows"] == 4
        assert verification["student_guardian_relationships"] == 4
