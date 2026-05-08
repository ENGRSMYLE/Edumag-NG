# EduMag NG — Project Bible

## Stack
- Frontend: Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui) → `./frontend`
- Backend: FastAPI (Python 3.11, SQLAlchemy async, PostgreSQL, Alembic) → `./backend`

## Roles
- `super_admin` → signs up as school, redirects to `/dashboard/super-admin`
- `admin` → invite-only by super_admin, redirects to `/dashboard/admin`  
- `teacher` → invite-only by super_admin, redirects to `/dashboard/staff`

## Critical Rules (NEVER violate)
- Every DB query MUST filter by `school_id` — no exceptions
- JWT stored in httpOnly cookies ONLY — never localStorage
- Money stored in KOBO (integer) — displayed as ₦ formatted
- All DB ops are async/await with selectinload() for relationships
- No lazy loading in async SQLAlchemy context

## Session Log
- [x] Session 1: Backend foundation (models, config, database)
- [x] Session 2: Backend auth (security, JWT, auth router)
- [x] Session 3: Backend RBAC + users router
- [x] Session 4: Frontend foundation (config, stores, lib)
- [x] Session 5: Frontend middleware + shared components
- [x] Session 6: Auth pages (login, signup, set-password)
- [ ] Session 7: Super Admin dashboard
- [x] Session 8: Admin dashboard
- [x] Session 9: Staff dashboard
- [x] Session 10: Students router + schemas + service + tests
- [x] Session 11: Classes router + Parents router + schemas + tests
- [x] Session 12: Attendance router + schemas + tests
- [x] Session 13: Results router + service + schemas + tests
- [x] Session 14: Finance router + service + schemas + tests
- [x] Session 15: Assignments router + schemas + tests
- [x] Session 16: Communication router + schemas + tests + full backend audit
- [x] Session 17: Frontend API integration (types, hooks, pages wired to real backend)
- [x] Session 18: Admin + Staff pages wired to real API (hooks: useAttendance, useResults, useAssignments, useParents)
- [x] Session 19: Cloudinary file upload integration (lib/cloudinary.ts, FileUpload component, students/new, assignments/new, settings logo)
- [x] Session 20: PDF report card generator (@react-pdf/renderer, ReportCard component, useReportCardPDF hook, admin results + student detail pages)
- [x] Session 21: Mobile responsive polish (sidebar slide-in, DataTable mobileHide columns + toolbar, staff communication two-panel mobile view, scores table overflow, target_audience enum fix + migration 003)

Phase 2 — Remaining Backend Routers:
- [x] students router (CRUD, bulk upload, class assignment, transfer, promote)
- [x] parents router (CRUD, link to student)
- [x] classes router (CRUD, teacher assignment)
- [x] attendance router (mark, edit, reports)
- [x] results router (enter scores, approve, generate report cards)
- [x] finance router (record payment, Paystack webhook, debtors)
- [x] assignments router (CRUD, submissions, grading)
- [x] communication router (announcements, messages)

Phase 2 — Remaining Frontend:
- [x] Connect all pages to real API (replace mock data with React Query hooks)
- [x] PDF report card generator
- [ ] Paystack payment integration
- [x] Cloudinary file upload integration
- [ ] SMS notifications (Africa's Talking)
- [x] Mobile responsive polish

## Phase 3 — Remaining Features
- [ ] Paystack payment integration (webhook, inline JS, payment confirmation flow)
- [ ] SMS notifications via Africa's Talking (attendance alerts, fee reminders, exam notices)
- [ ] Parent portal (separate login flow, view child's results, attendance, fee balance)
- [ ] Advanced analytics dashboard (cohort trends, per-subject heatmaps, revenue forecasting)
- [ ] Paystack subscription billing for the SaaS platform itself (per-school monthly plan)
- [ ] Push notifications (web push / PWA) for real-time unread message alerts

## Phase 2 — Backend Routers Needed
All frontend pages exist with mock data. These backend routers must be built before the app is fully functional:
- `/students/` — CRUD, bulk-upload, generate-admission-number
- `/parents/` — CRUD, link to student
- `/classes/` — CRUD, assign teacher
- `/attendance/` — submit, history, check-date, report
- `/results/` — per-student score entry, report, approve, generate
- `/assignments/` — CRUD, submissions, grade submission
- `/finance/` — payments, debtors, record payment
- `/announcements/` — list, create
- `/messages/` — send, list (staff ↔ admin)
- `/dashboard/overview` — aggregate stats endpoint
- `/settings/` — school profile, grade scales, terms, logo, audit logs

## Multi-School Architecture (implemented pre-Session-2)
- One `User` (global, identified by email) → many `SchoolMembership` rows
- `SchoolMembership` holds: user_id, school_id, role, class_id, invite_token, is_active
- JWT payload: `sub` (user_id), `school_id`, `role`, `membership_id`
- Login with 1 membership → `TokenResponse` directly
- Login with 2+ memberships → `LoginStep1Response` (temp_token + schools[]) → `/select-school`
- `get_current_user` attaches: `current_school_id`, `current_role`, `current_membership_id`, `current_class_id`
- `create_invite_token(membership_id)` — sub is membership.id, not user.id
- Deactivate = set `SchoolMembership.is_active=False` + revoke tokens for that membership only
- Existing user invited to new school → new SchoolMembership only + `send_school_linked_email()`
- RefreshToken.membership_id (not school_id) — revocation is per-school-session
- `/select-school` added to PUBLIC_ROUTES in middleware

## Decisions Made
- Financial amounts: stored in kobo, displayed with formatNaira()
- Refresh tokens: stored in DB with used_at field, rotated on every use
- First login: is_first_login=True forces /set-password redirect
- Bulk upload: per-row validation, partial success allowed

## Design Skills Active
- UI UX Pro Max: installed at .claude/skills/ui-ux-pro-max/ (auto-activates)
- Taste Skill: ./frontend/TASTE-SKILL.md (reference with @TASTE-SKILL.md)
- Soft Skill: ./frontend/SOFT-SKILL.md (reference with @SOFT-SKILL.md)
- Frontend Design: /mnt/skills/public/frontend-design/SKILL.md (auto-activates)

## Taste Skill Settings for EduMag NG
DESIGN_VARIANCE: 6       ← Modern but structured (dashboard context)
MOTION_INTENSITY: 5      ← Smooth transitions, no excessive animation
VISUAL_DENSITY: 7        ← Data-dense dashboards need compact layouts