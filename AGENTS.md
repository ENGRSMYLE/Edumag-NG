# AGENTS.md

## Start Here

Before implementing or modifying any feature, read this file completely, then read the relevant code and tests. Treat `CLAUDE.md` as project history and intent; when it is stale, the current implementation and migrations are authoritative. Never infer that a checklist item is working without tracing its API, UI, model, migration, and tests.

## Project Overview

EduMag NG is a multi-tenant Nigerian school-management platform. A global `User` can belong to multiple schools through `SchoolMembership`; every authenticated request operates in one membership context. Implemented domains include authentication, staff, students, classes, guardians/parents, attendance, results/report cards, finance, assignments, communication, notifications/push, and school settings.

Architecture:

- `frontend/`: Next.js App Router client, organized by public and role-specific routes.
- `backend/`: FastAPI API with async SQLAlchemy and PostgreSQL.
- Browser auth uses secure httpOnly API cookies; Zustand holds identity and an in-memory access-token fallback. The `_auth_role` cookie is only a routing hint, never authorization.
- The backend is the authorization and tenant-isolation boundary.

## Technology Stack

- Frontend: Next.js 15, React 19, TypeScript strict mode, Tailwind CSS, TanStack Query, Zustand, React Hook Form/Zod, Axios, Recharts, `@react-pdf/renderer`, PWA/Web Push.
- Backend: Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 async/asyncpg, PostgreSQL 16, Alembic, JWT, bcrypt, slowapi.
- Integrations: Resend email, Cloudinary uploads, Paystack payments, Web Push/VAPID. Redis is configured but is not the primary persistence layer.
- Tests: pytest/pytest-asyncio/httpx against PostgreSQL; Node test runner for PWA behavior; ESLint and TypeScript for frontend validation.

## Repository Map

- `frontend/app/(public)/`: landing, signup/OTP, login, school selection, invite password setup, password recovery.
- `frontend/app/(dashboard)/dashboard/{super-admin,admin,staff,parent}/`: role portals.
- `frontend/components/`: layout, shared UI, parent, PWA, and module components.
- `frontend/hooks/`: TanStack Query/domain hooks and permission helpers.
- `frontend/lib/api.ts`: shared Axios client and endpoint wrappers.
- `frontend/constants/permissions.ts`: client-side UX permission map; keep aligned with backend RBAC.
- `frontend/store/authStore.ts`: session identity and routing hint; do not persist tokens.
- `backend/app/routers/`: HTTP endpoints and request-level authorization.
- `backend/app/services/`: domain workflows and external integrations.
- `backend/app/models/`, `schemas/`: database entities and API contracts.
- `backend/app/dependencies/`: authentication, RBAC, and parent context.
- `backend/alembic/versions/`: ordered production schema history; migrations `001` through `017` currently exist.
- `backend/tests/`: API, tenancy, security, parent, notification, and domain tests.
- `backend/scripts/`: notification worker and legacy-parent migration utilities.

## Coding Conventions

- Keep TypeScript strict; use `@/` imports and typed API contracts. Avoid `any`, duplicate domain constants, hard-coded academic data, and mock data in production pages.
- Use TanStack Query for server state, invalidate relevant keys after mutations, and show loading, empty, error, and retry states.
- Backend operations are async. Use `select()` plus explicit eager loading (`selectinload`); never rely on async lazy loading.
- Keep routers thin; put multi-step or reusable business rules in services. Validate tenant ownership before mutation.
- Store money as integer kobo and format naira only at presentation boundaries.
- Normalize identity fields consistently. Do not log passwords, tokens, secrets, sensitive child data, or raw push credentials.
- Preserve established responsive and accessibility patterns. Reuse shared components rather than cloning role pages unless behavior differs.

## Authentication, RBAC, and Tenancy

- Roles are `super_admin`, `admin`, `teacher`, and `parent`. `super_admin` has backend wildcard permission; other permissions live in `backend/app/dependencies/rbac.py`.
- JWT context contains `sub`, `school_id`, `role`, and `membership_id`. `get_current_user` verifies an active user and the exact active membership, then attaches current school/role/membership/class context.
- Staff and parents are invite-based. Invite tokens identify membership IDs; first activation sets/establishes the account and activates that membership. Refresh tokens are stored and revoked per membership.
- A parent must additionally pass the enabled-school, active guardian-profile, and active relationship checks. Child access is relationship- and permission-scoped.
- **Every tenant-owned query and write must include or inherit a verified `school_id` boundary.** Never accept school identity from a request body when membership context supplies it. Verify related IDs (class, student, teacher, guardian, payment, result) belong to the same school.
- Frontend route guards improve UX only. Enforce every sensitive operation in backend dependencies and service queries.
- Keep backend and frontend permission maps aligned, but never trust frontend permission checks for security.

## Database and Migrations

- PostgreSQL is required; tests use PostgreSQL-specific behavior and types.
- For a schema change, update model, schema/service/router behavior, `backend/app/models/__init__.py`, Alembic migration, and tests together.
- Add a new forward-only Alembic revision with the correct `down_revision`; do not rewrite an applied migration. Provide a safe downgrade where practical.
- Preserve composite tenant constraints and indexes. Tenant-owned relationships should prevent cross-school foreign-key combinations where feasible.
- Use transactions for multi-record workflows. Use savepoints only when partial success is intentional (for example, student bulk import).
- Run `alembic upgrade head` before the API in deployed environments; the backend Docker image already does this.
- Never use `Base.metadata.create_all()` in production. Never run the test suite against a non-disposable database: the session fixture drops and recreates all metadata.

## Testing and Validation

Run checks proportional to the change:

- Frontend type check: `cd frontend; npx tsc --noEmit --incremental false`
- Frontend lint: `cd frontend; npm run lint`
- PWA tests: `cd frontend; npm run test:pwa`
- Backend collection: `cd backend; python -m pytest --collect-only -q`
- Backend tests: set `TEST_DATABASE_URL` to an explicitly disposable PostgreSQL database, then run `cd backend; python -m pytest -q`.
- Migration check: upgrade a fresh disposable database to head and, for migration work, test downgrade/upgrade as appropriate.

For tenant or authorization work, add negative tests for another school, another class/relationship, inactive membership, and insufficient role. For workflows, test API contracts plus the consuming UI path. Do not claim completion while lint/type-check/tests relevant to the change fail; document pre-existing failures separately.

## Important Development Rules

- Inspect the complete workflow before editing: entry UI -> API wrapper/hook -> router dependency -> service -> model/query -> migration -> tests.
- Preserve existing user changes and unrelated worktree modifications.
- Do not add a library, service, or parallel data model without showing why the existing stack cannot meet the requirement.
- Invitations, email, payment, upload, and push flows need explicit failure/retry behavior. External-delivery success must not be assumed from successful database writes.
- Operational academic data should come from school configuration. Avoid free-text or duplicated constants when integrity depends on a configured term, subject, class, fee, or staff assignment.
- A feature is not production-ready merely because an endpoint or page exists; verify integration, authorization, empty/error states, persistence, migration, and tests.

## Common Mistakes to Avoid

- Querying by a globally unique-looking ID without also enforcing the active school.
- Persisting JWTs in localStorage/sessionStorage or treating `_auth_role` as proof of identity.
- Updating `Class.teacher_id` without `SchoolMembership.class_id`, or vice versa.
- Creating free-text session/term/subject/fee records that conflict with school settings.
- Mixing legacy `Parent` contact rows with guardian login accounts without the documented migration/reconciliation path.
- Sending invitations before the required class/student/guardian relationship exists, or omitting resend and status handling.
- Introducing N+1 queries or lazy relationship access in async SQLAlchemy.
- Using naira decimals in storage, trusting client-calculated totals, or accepting unsigned Paystack callbacks.
- Editing generated artifacts (`.next`, `tsconfig.tsbuildinfo`, caches) or committing secrets/environment files.
- Relying on `CLAUDE.md` session checkboxes when current code or tests show a different status.
