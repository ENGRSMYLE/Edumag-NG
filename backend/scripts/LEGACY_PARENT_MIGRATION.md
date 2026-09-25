# Legacy parent migration runbook

Run commands from `backend/`. Always audit before backfilling.

```powershell
.\venv\Scripts\python.exe -m scripts.migrate_legacy_parents audit --school-id SCHOOL_UUID --output parent-reconciliation.csv
.\venv\Scripts\python.exe -m scripts.migrate_legacy_parents backfill --school-id SCHOOL_UUID --actor-user-id ADMIN_USER_UUID
.\venv\Scripts\python.exe -m scripts.migrate_legacy_parents verify --school-id SCHOOL_UUID
```

`audit` is read-only. The CSV includes blank resolution fields for operational review. Name-only matches, missing/invalid contacts, email/phone conflicts, staff-role conflicts, and primary-guardian conflicts are never migrated automatically.

`backfill` is idempotent and leaves every row in `parents` unchanged. It creates inactive invited memberships but does not send invitations; administrators should review migrated accounts before resending invitations.

During the compatibility release, student responses prefer `student_guardians` and fall back to `parents` only when no new relationships exist. Do not remove the legacy table until every school’s `verify` report is accepted. Removal requires a separate later migration.
