import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.parent import ParentContext, get_current_parent_context
from app.schemas.parent_portal import (
    PaginatedParentAssignments,
    PaginatedParentAttendance,
    PaginatedParentChildren,
    PaginatedParentFinance,
    PaginatedParentResults,
    ParentChildResponse,
    ParentDashboardResponse,
    ParentProfileResponse,
    ParentProfileUpdate,
)
from app.services.parent_portal import (
    get_assignments_page,
    get_attendance_page,
    get_child,
    get_children_page,
    get_dashboard,
    get_finance_page,
    get_parent_profile,
    get_results_page,
    update_parent_profile,
)

router = APIRouter(prefix="/parents/me", tags=["parent portal"])


@router.get("", response_model=ParentProfileResponse)
async def profile(
    context: ParentContext = Depends(get_current_parent_context),
) -> ParentProfileResponse:
    return get_parent_profile(context)


@router.patch("", response_model=ParentProfileResponse)
async def edit_profile(
    payload: ParentProfileUpdate,
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
) -> ParentProfileResponse:
    return await update_parent_profile(db, context, payload)


@router.get("/children", response_model=PaginatedParentChildren)
async def children(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
) -> PaginatedParentChildren:
    return await get_children_page(db, context, page, per_page)


@router.get("/children/{student_id}", response_model=ParentChildResponse)
async def child(
    student_id: uuid.UUID,
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
) -> ParentChildResponse:
    return await get_child(db, context, student_id)


@router.get("/dashboard", response_model=ParentDashboardResponse)
async def dashboard(
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
) -> ParentDashboardResponse:
    return await get_dashboard(db, context)


def _pagination(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100)):
    return page, per_page


@router.get("/children/{student_id}/attendance", response_model=PaginatedParentAttendance)
async def attendance(
    student_id: uuid.UUID,
    pagination: tuple[int, int] = Depends(_pagination),
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
):
    return await get_attendance_page(db, context, student_id, *pagination)


@router.get("/children/{student_id}/results", response_model=PaginatedParentResults)
async def results(
    student_id: uuid.UUID,
    pagination: tuple[int, int] = Depends(_pagination),
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
):
    return await get_results_page(db, context, student_id, *pagination)


@router.get("/children/{student_id}/assignments", response_model=PaginatedParentAssignments)
async def assignments(
    student_id: uuid.UUID,
    pagination: tuple[int, int] = Depends(_pagination),
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
):
    return await get_assignments_page(db, context, student_id, *pagination)


@router.get("/children/{student_id}/finance", response_model=PaginatedParentFinance)
async def finance(
    student_id: uuid.UUID,
    pagination: tuple[int, int] = Depends(_pagination),
    context: ParentContext = Depends(get_current_parent_context),
    db: AsyncSession = Depends(get_db),
):
    return await get_finance_page(db, context, student_id, *pagination)
