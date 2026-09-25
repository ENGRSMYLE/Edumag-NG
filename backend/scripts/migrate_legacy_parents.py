"""Dry-run-first legacy parent audit and backfill utility."""
import argparse
import asyncio
import csv
import json
import uuid
from pathlib import Path

from app.database import AsyncSessionLocal
from app.services.legacy_parent_migration import audit_legacy_parents, backfill_safe_legacy_parents, verify_legacy_parent_backfill

def arguments():
    parser = argparse.ArgumentParser(description="Audit and safely migrate legacy parent rows")
    parser.add_argument("command", choices=["audit", "backfill", "verify"])
    parser.add_argument("--school-id", required=True, type=uuid.UUID)
    parser.add_argument("--actor-user-id", type=uuid.UUID)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()

def write_reconciliation(report: dict, path: Path):
    categories = ["duplicate_emails", "missing_emails", "duplicate_phones", "conflicting_email_phone_matches", "likely_duplicate_guardians", "invalid_contact_data"]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["category", "legacy_parent_ids", "reason", "email", "phone", "resolution", "resolved_guardian_profile_id"])
        writer.writeheader()
        for category in categories:
            for issue in report[category]:
                writer.writerow({"category": category, "legacy_parent_ids": ";".join(issue["legacy_parent_ids"]), "reason": issue["reason"], "email": issue.get("email") or "", "phone": issue.get("phone") or "", "resolution": "", "resolved_guardian_profile_id": ""})

async def main():
    args = arguments()
    async with AsyncSessionLocal() as db:
        if args.command == "audit":
            result = (await audit_legacy_parents(db, args.school_id)).to_dict()
            if args.output: write_reconciliation(result, args.output)
        elif args.command == "backfill":
            if not args.actor_user_id: raise SystemExit("--actor-user-id is required for backfill")
            result = await backfill_safe_legacy_parents(db, args.school_id, args.actor_user_id)
        else:
            result = await verify_legacy_parent_backfill(db, args.school_id)
        print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())
