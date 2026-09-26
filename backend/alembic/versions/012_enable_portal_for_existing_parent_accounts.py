"""Enable the portal for schools with parent invitations or accounts.

Revision ID: 012
Revises: 011
"""

from alembic import op


revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE schools AS school
        SET parent_portal_enabled = TRUE
        WHERE school.parent_portal_enabled = FALSE
          AND EXISTS (
              SELECT 1
              FROM school_memberships AS membership
              JOIN guardian_profiles AS profile
                ON profile.membership_id = membership.id
               AND profile.school_id = membership.school_id
              JOIN student_guardians AS relationship
                ON relationship.guardian_profile_id = profile.id
               AND relationship.school_id = profile.school_id
              JOIN students AS student
                ON student.id = relationship.student_id
               AND student.school_id = relationship.school_id
              WHERE membership.school_id = school.id
                AND membership.role = 'parent'
                AND profile.status IN ('invited', 'active')
                AND relationship.is_active = TRUE
                AND student.is_active = TRUE
          )
        """
    )


def downgrade() -> None:
    # Data repair: reverting it would overwrite later administrator choices.
    pass
