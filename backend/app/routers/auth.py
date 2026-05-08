import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.email_verification import EmailVerification
from app.models.refresh_token import RefreshToken
from app.models.school import School
from app.models.school_membership import SchoolMembership
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginStep1Response,
    RefreshRequest,
    RegisterSchoolRequest,
    SchoolOption,
    SelectSchoolRequest,
    SendOTPRequest,
    SetPasswordRequest,
    SwitchSchoolRequest,
    TokenResponse,
    UserInToken,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from app.services.email_service import send_otp_email, send_welcome_email
from app.utils.rate_limit import limiter
from app.utils.security import (
    create_access_token,
    create_invite_token,
    create_refresh_token,
    create_temp_token,
    create_verification_token,
    decode_token,
    generate_otp,
    hash_otp,
    hash_password,
    hash_token,
    verify_otp,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = settings.is_production
    samesite = "none" if settings.is_production else "lax"
    response.set_cookie(
        key=_ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_auth_cookies(response: Response) -> None:
    samesite = "none" if settings.is_production else "lax"
    secure = settings.is_production
    response.set_cookie(
        key=_ACCESS_COOKIE, value="", httponly=True,
        samesite=samesite, secure=secure, max_age=0
    )
    response.set_cookie(
        key=_REFRESH_COOKIE, value="", httponly=True,
        samesite=samesite, secure=secure, max_age=0
    )


# ---------------------------------------------------------------------------
# Token / response helpers
# ---------------------------------------------------------------------------

def _role_str(role) -> str:
    return getattr(role, "value", role)


def _token_payload(
    user: User,
    membership: SchoolMembership,
) -> dict:
    return {
        "sub": str(user.id),
        "school_id": str(membership.school_id),
        "role": _role_str(membership.role),
        "membership_id": str(membership.id),
    }


def _build_token_response(
    access_token: str,
    user: User,
    membership: SchoolMembership,
    school_name: str,
) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        user=UserInToken(
            id=user.id,
            name=user.name,
            email=user.email,
            role=_role_str(membership.role),
            school_id=membership.school_id,
            school_name=school_name,
            membership_id=membership.id,
            is_first_login=user.is_first_login,
            profile_photo_url=user.profile_photo_url,
            current_class_id=membership.class_id,
        ),
    )


async def _store_refresh_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    membership_id: uuid.UUID,
    raw_refresh_token: str,
) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    db.add(
        RefreshToken(
            user_id=user_id,
            membership_id=membership_id,
            token_hash=hash_token(raw_refresh_token),
            expires_at=expires_at,
        )
    )


async def _revoke_membership_tokens(
    db: AsyncSession, membership_id: uuid.UUID
) -> None:
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.membership_id == membership_id,
            RefreshToken.revoked.is_(False),
        )
        .values(revoked=True)
    )


# ---------------------------------------------------------------------------
# POST /send-otp
# ---------------------------------------------------------------------------

@router.post("/send-otp")
@limiter.limit("3/10minute")
async def send_otp(
    request: Request,
    body: SendOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Check if email is already registered as a super_admin
    existing_user_result = await db.execute(
        select(User).where(User.email == body.email)
    )
    existing_user: User | None = existing_user_result.scalar_one_or_none()

    if existing_user:
        active_membership = await db.execute(
            select(SchoolMembership).where(
                SchoolMembership.user_id == existing_user.id,
                SchoolMembership.role == "super_admin",
                SchoolMembership.is_active.is_(True),
            )
        )
        if active_membership.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "EMAIL_ALREADY_REGISTERED",
                    "detail": "An account with this email already exists. Please log in.",
                },
            )

    # Invalidate any previous unused OTPs for this email + signup
    await db.execute(
        update(EmailVerification)
        .where(
            EmailVerification.email == body.email,
            EmailVerification.purpose == "signup",
            EmailVerification.is_used.is_(False),
        )
        .values(is_used=True)
    )

    otp = generate_otp()
    otp_hashed = hash_otp(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    verification = EmailVerification(
        email=body.email,
        otp_hash=otp_hashed,
        purpose="signup",
        expires_at=expires_at,
        is_used=False,
        attempts=0,
    )
    db.add(verification)
    await db.commit()

    background_tasks.add_task(send_otp_email, body.email, otp, body.school_name)

    return {
        "message": "Verification code sent to your email",
        "expires_in_minutes": 10,
    }


# ---------------------------------------------------------------------------
# POST /verify-otp
# ---------------------------------------------------------------------------

@router.post("/verify-otp", response_model=VerifyOTPResponse)
@limiter.limit("5/10minute")
async def verify_otp_endpoint(
    request: Request,
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyOTPResponse:
    # Find the most recent unused verification for this email + signup
    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.email == body.email,
            EmailVerification.purpose == "signup",
            EmailVerification.is_used.is_(False),
        )
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    verification: EmailVerification | None = result.scalar_one_or_none()

    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OTP_NOT_FOUND",
                "detail": "No verification code found. Please request a new one.",
            },
        )

    if verification.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OTP_EXPIRED",
                "detail": "Code expired. Please request a new one.",
            },
        )

    # Increment attempts before checking — prevents race conditions
    verification.attempts += 1
    await db.flush()

    if verification.attempts > 5:
        verification.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OTP_MAX_ATTEMPTS",
                "detail": "Too many wrong attempts. Please request a new code.",
            },
        )

    if not verify_otp(body.otp, verification.otp_hash):
        await db.commit()
        remaining = 5 - verification.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OTP_INVALID",
                "detail": f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
            },
        )

    # OTP correct — mark as used and issue verification token
    verification.is_used = True
    await db.commit()

    token = create_verification_token(body.email)
    return VerifyOTPResponse(verified=True, verification_token=token)


# ---------------------------------------------------------------------------
# POST /register-school
# ---------------------------------------------------------------------------

@router.post(
    "/register-school",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def register_school(
    request: Request,
    body: RegisterSchoolRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # ── Verify email verification token ──────────────────────────────────────
    try:
        vt_payload = decode_token(body.verification_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VERIFICATION_REQUIRED",
                "detail": "Email not verified. Please complete email verification first.",
            },
        )

    if vt_payload.get("type") != "email_verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VERIFICATION_REQUIRED",
                "detail": "Email not verified. Please complete email verification first.",
            },
        )

    if vt_payload.get("email") != body.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "EMAIL_MISMATCH",
                "detail": "Email does not match verified email. Please verify again.",
            },
        )

    # ── Existing registration logic ───────────────────────────────────────────
    existing_user_result = await db.execute(
        select(User).where(User.email == body.email)
    )
    existing_user: User | None = existing_user_result.scalar_one_or_none()

    if not existing_user:
        school_email_check = await db.execute(
            select(School).where(School.email == body.email)
        )
        if school_email_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A school with this email already exists",
            )

    try:
        school = School(
            name=body.school_name,
            school_type=body.school_type,
            address=body.address,
            lga=body.lga,
            state=body.state,
            phone=body.phone,
            email=body.email,
        )
        db.add(school)
        await db.flush()

        if existing_user:
            if not verify_password(body.password, existing_user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Password incorrect for existing account",
                )
            dup_check = await db.execute(
                select(SchoolMembership)
                .join(School, School.id == SchoolMembership.school_id)
                .where(
                    SchoolMembership.user_id == existing_user.id,
                    SchoolMembership.role == "super_admin",
                    School.name == body.school_name,
                )
            )
            if dup_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You already have a school with this name",
                )
            admin = existing_user
        else:
            admin = User(
                name=body.admin_name,
                email=body.email,
                password_hash=hash_password(body.password),
                is_active=True,
                is_first_login=False,
            )
            db.add(admin)
            await db.flush()

        membership = SchoolMembership(
            user_id=admin.id,
            school_id=school.id,
            role="super_admin",
            is_active=True,
        )
        db.add(membership)
        await db.flush()

        payload = _token_payload(admin, membership)
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)
        await _store_refresh_token(db, admin.id, membership.id, refresh_token)

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("register_school failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again.",
        )

    _set_auth_cookies(response, access_token, refresh_token)
    background_tasks.add_task(send_welcome_email, admin.email, admin.name, school.name)
    return _build_token_response(access_token, admin, membership, school.name)


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------

@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )

    result = await db.execute(select(User).where(User.email == body.email))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise _invalid

    if not verify_password(body.password, user.password_hash):
        raise _invalid

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deactivated",
        )

    memberships_result = await db.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == user.id,
            SchoolMembership.is_active.is_(True),
        )
        .options(selectinload(SchoolMembership.school))
    )
    memberships = memberships_result.scalars().all()

    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active school memberships. Contact your school administrator.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    if len(memberships) == 1:
        membership = memberships[0]
        await _revoke_membership_tokens(db, membership.id)

        payload = _token_payload(user, membership)
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)
        await _store_refresh_token(db, user.id, membership.id, refresh_token)
        await db.commit()

        school_name = membership.school.name if membership.school else ""
        _set_auth_cookies(response, access_token, refresh_token)
        return _build_token_response(access_token, user, membership, school_name)

    temp_token = create_temp_token(str(user.id))
    school_options = [
        SchoolOption(
            membership_id=m.id,
            school_id=m.school_id,
            school_name=m.school.name if m.school else "",
            school_logo_url=m.school.logo_url if m.school else None,
            role=_role_str(m.role),
            is_first_login=user.is_first_login,
        )
        for m in memberships
    ]
    return LoginStep1Response(
        requires_school_selection=True,
        temp_token=temp_token,
        schools=school_options,
        user_name=user.name,
    )


# ---------------------------------------------------------------------------
# POST /select-school
# ---------------------------------------------------------------------------

@router.post("/select-school", response_model=TokenResponse)
@limiter.limit("5/minute")
async def select_school(
    request: Request,
    body: SelectSchoolRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        payload = decode_token(body.temp_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    if payload.get("type") != "temp":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    try:
        user_id = uuid.UUID(str(user_id_raw))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )

    membership_result = await db.execute(
        select(SchoolMembership)
        .where(SchoolMembership.id == body.membership_id)
        .options(selectinload(SchoolMembership.school))
    )
    membership: SchoolMembership | None = membership_result.scalar_one_or_none()

    if membership is None or membership.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid school selection",
        )

    if not membership.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This membership is no longer active",
        )

    user_result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    await _revoke_membership_tokens(db, membership.id)

    payload_new = _token_payload(user, membership)
    access_token = create_access_token(payload_new)
    refresh_token = create_refresh_token(payload_new)
    await _store_refresh_token(db, user.id, membership.id, refresh_token)
    await db.commit()

    school_name = membership.school.name if membership.school else ""
    _set_auth_cookies(response, access_token, refresh_token)
    return _build_token_response(access_token, user, membership, school_name)


# ---------------------------------------------------------------------------
# POST /switch-school
# ---------------------------------------------------------------------------

@router.post("/switch-school", response_model=TokenResponse)
@limiter.limit("10/minute")
async def switch_school(
    request: Request,
    body: SwitchSchoolRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    membership_result = await db.execute(
        select(SchoolMembership)
        .where(SchoolMembership.id == body.membership_id)
        .options(selectinload(SchoolMembership.school))
    )
    membership: SchoolMembership | None = membership_result.scalar_one_or_none()

    if membership is None or membership.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School not found in your memberships",
        )

    if not membership.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This membership is no longer active",
        )

    await _revoke_membership_tokens(
        db, current_user.current_membership_id  # type: ignore[attr-defined]
    )

    payload = _token_payload(current_user, membership)
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)
    await _store_refresh_token(db, current_user.id, membership.id, refresh_token)
    await db.commit()

    school_name = membership.school.name if membership.school else ""
    _set_auth_cookies(response, access_token, refresh_token)
    return _build_token_response(access_token, current_user, membership, school_name)


# ---------------------------------------------------------------------------
# GET /my-schools
# ---------------------------------------------------------------------------

@router.get("/my-schools", response_model=list[SchoolOption])
@limiter.limit("20/minute")
async def my_schools(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SchoolOption]:
    memberships_result = await db.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == current_user.id,
            SchoolMembership.is_active.is_(True),
        )
        .options(selectinload(SchoolMembership.school))
    )
    memberships = memberships_result.scalars().all()

    return [
        SchoolOption(
            membership_id=m.id,
            school_id=m.school_id,
            school_name=m.school.name if m.school else "",
            school_logo_url=m.school.logo_url if m.school else None,
            role=_role_str(m.role),
            is_first_login=current_user.is_first_login,
        )
        for m in memberships
    ]


# ---------------------------------------------------------------------------
# POST /refresh
# ---------------------------------------------------------------------------

@router.post("/refresh")
@limiter.limit("5/minute")
async def refresh_token(
    request: Request,
    response: Response,
    body: RefreshRequest = RefreshRequest(),
    refresh_token_cookie: str | None = Cookie(alias="refresh_token", default=None),
    db: AsyncSession = Depends(get_db),
):
    raw_token = refresh_token_cookie or body.refresh_token
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    payload = decode_token(raw_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    token_hash = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored: RefreshToken | None = result.scalar_one_or_none()

    if stored is None or stored.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalid",
        )

    if stored.used_at is not None:
        logger.warning(
            "SECURITY: refresh token reuse detected for membership %s",
            stored.membership_id,
        )
        await _revoke_membership_tokens(db, stored.membership_id)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security alert: token reuse detected. All sessions revoked.",
        )

    if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    membership_result = await db.execute(
        select(SchoolMembership)
        .where(SchoolMembership.id == stored.membership_id)
        .options(selectinload(SchoolMembership.school))
    )
    membership: SchoolMembership | None = membership_result.scalar_one_or_none()

    if membership is None or not membership.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Membership is no longer active",
        )

    user_result = await db.execute(
        select(User).where(User.id == stored.user_id)
    )
    user: User | None = user_result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    stored.used_at = datetime.now(timezone.utc)

    payload_new = _token_payload(user, membership)
    new_access = create_access_token(payload_new)
    new_refresh = create_refresh_token(payload_new)
    await _store_refresh_token(db, user.id, membership.id, new_refresh)
    await db.commit()

    school_name = membership.school.name if membership.school else ""
    _set_auth_cookies(response, new_access, new_refresh)
    return _build_token_response(new_access, user, membership, school_name)


# ---------------------------------------------------------------------------
# POST /logout
# ---------------------------------------------------------------------------

@router.post("/logout")
@limiter.limit("5/minute")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _revoke_membership_tokens(
        db, current_user.current_membership_id  # type: ignore[attr-defined]
    )
    await db.commit()
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------

@router.get("/me")
@limiter.limit("30/minute")
async def me(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if current_user.is_first_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PASSWORD_CHANGE_REQUIRED",
                "message": "Please set your password",
            },
        )

    school_result = await db.execute(
        select(School).where(
            School.id == current_user.current_school_id  # type: ignore[attr-defined]
        )
    )
    school: School | None = school_result.scalar_one_or_none()
    school_name = school.name if school else ""

    return UserInToken(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.current_role.value,  # type: ignore[attr-defined]
        school_id=current_user.current_school_id,  # type: ignore[attr-defined]
        school_name=school_name,
        membership_id=current_user.current_membership_id,  # type: ignore[attr-defined]
        is_first_login=current_user.is_first_login,
        profile_photo_url=current_user.profile_photo_url,
        current_class_id=current_user.current_class_id,  # type: ignore[attr-defined]
    ).model_dump()


# ---------------------------------------------------------------------------
# POST /set-password
# ---------------------------------------------------------------------------

@router.post("/set-password", response_model=TokenResponse)
@limiter.limit("5/minute")
async def set_password(
    request: Request,
    body: SetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    payload = decode_token(body.invite_token)

    if payload.get("type") != "invite":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid invite token",
        )

    membership_id_raw = payload.get("sub")
    if not membership_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed invite token",
        )

    try:
        membership_id = uuid.UUID(str(membership_id_raw))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed invite token",
        )

    membership_result = await db.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.id == membership_id,
            SchoolMembership.invite_token == body.invite_token,
        )
        .options(selectinload(SchoolMembership.school))
    )
    membership: SchoolMembership | None = membership_result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid invite token",
        )

    if membership.invite_token_expires is None or membership.invite_token_expires.replace(
        tzinfo=timezone.utc
    ) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invite token has expired",
        )

    user_result = await db.execute(
        select(User).where(User.id == membership.user_id)
    )
    user: User | None = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite token",
        )

    if user.is_first_login:
        user.password_hash = hash_password(body.new_password)
        user.is_first_login = False

    membership.is_active = True
    membership.invite_token = None
    membership.invite_token_expires = None

    token_payload = _token_payload(user, membership)
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    await _store_refresh_token(db, user.id, membership.id, refresh_token)

    await db.commit()
    await db.refresh(user)

    school_name = membership.school.name if membership.school else ""
    _set_auth_cookies(response, access_token, refresh_token)
    return _build_token_response(access_token, user, membership, school_name)
