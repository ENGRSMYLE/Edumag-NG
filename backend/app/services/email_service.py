import asyncio
import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY

_BRAND_COLOR = "#1a56db"
_LOGO_PLACEHOLDER = "EduMag NG"


def _base_html(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:{_BRAND_COLOR};padding:28px 40px;">
              <span style="color:#ffffff;font-size:22px;font-weight:bold;
                           letter-spacing:0.5px;">{_LOGO_PLACEHOLDER}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;color:#1a1a2e;font-size:15px;line-height:1.7;">
              {body_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f4f6fb;padding:20px 40px;
                       font-size:12px;color:#6b7280;text-align:center;
                       border-top:1px solid #e5e7eb;">
              &copy; 2026 EduMag NG &mdash; Empowering Nigerian Schools<br/>
              This email was sent by {settings.FROM_EMAIL}. Do not reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _get_id(result) -> str:
    if isinstance(result, dict):
        return result.get("id", "?")
    return getattr(result, "id", "?")


async def send_invite_email(
    to_email: str,
    to_name: str,
    school_name: str,
    role: str,
    invite_link: str,
    temp_password: str,
) -> None:
    role_label = role.replace("_", " ").title()
    body_html = f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>
        You have been invited to join <strong>{school_name}</strong> on
        <strong>EduMag NG</strong> as a <strong>{role_label}</strong>.
      </p>
      <p>Use the button below to set your password and activate your account:</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="{invite_link}"
           style="background:{_BRAND_COLOR};color:#ffffff;text-decoration:none;
                  padding:14px 32px;border-radius:6px;font-size:15px;
                  font-weight:bold;display:inline-block;">
          Accept Invitation &amp; Set Password
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="{invite_link}" style="color:{_BRAND_COLOR};">{invite_link}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
      <p style="font-size:13px;color:#6b7280;">
        Your temporary password (for reference only — you will set a new one):<br/>
        <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;
                     font-size:13px;">{temp_password}</code>
      </p>
      <p style="font-size:13px;color:#6b7280;">
        This invitation link expires in 48 hours. If you did not expect this email,
        please ignore it.
      </p>
    """
    payload = {
        "from": f"EduMag NG <{settings.FROM_EMAIL}>",
        "to": [to_email],
        "subject": f"You're invited to join {school_name} on EduMag NG",
        "html": _base_html(f"Invitation to {school_name}", body_html),
    }
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: resend.Emails.send(payload))
        logger.info("Invite email sent to %s (id=%s)", to_email, _get_id(result))
    except Exception:
        logger.exception("Failed to send invite email to %s", to_email)


async def send_school_linked_email(
    to_email: str,
    to_name: str,
    school_name: str,
    role: str,
    invite_link: str,
) -> None:
    role_label = role.replace("_", " ").title()
    body_html = f"""
      <p>Hello <strong>{to_name}</strong>,</p>
      <p>
        Your EduMag NG account has been linked to <strong>{school_name}</strong>
        with the role of <strong>{role_label}</strong>.
      </p>
      <p>Click the button below to accept the invitation and activate your access:</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="{invite_link}"
           style="background:{_BRAND_COLOR};color:#ffffff;text-decoration:none;
                  padding:14px 32px;border-radius:6px;font-size:15px;
                  font-weight:bold;display:inline-block;">
          Accept Invitation
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="{invite_link}" style="color:{_BRAND_COLOR};">{invite_link}</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">
        You can use your existing EduMag NG password to log in after accepting.
        This invitation link expires in {settings.INVITE_TOKEN_EXPIRE_HOURS} hours.
        If you did not expect this email, please ignore it.
      </p>
    """
    payload = {
        "from": f"EduMag NG <{settings.FROM_EMAIL}>",
        "to": [to_email],
        "subject": f"You've been invited to join {school_name} on EduMag NG",
        "html": _base_html(f"Invitation to {school_name}", body_html),
    }
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: resend.Emails.send(payload))
        logger.info("School-linked email sent to %s (id=%s)", to_email, _get_id(result))
    except Exception:
        logger.exception("Failed to send school-linked email to %s", to_email)


async def send_otp_email(to_email: str, otp: str, school_name: str) -> None:
    logger.info("Sending OTP email to %s for school '%s'", to_email, school_name)
    body_html = f"""
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px;">
        You're creating a school account for <strong>{school_name}</strong>.
        Enter this code to verify your email address:
      </p>

      <div style="background:#f4f6fb;border-radius:12px;padding:32px 24px;
                  text-align:center;margin:28px 0;">
        <p style="color:#9BAEC8;font-size:11px;text-transform:uppercase;
                  letter-spacing:2px;margin:0 0 12px 0;">
          Your verification code
        </p>
        <p style="color:#0A1628;font-size:48px;font-weight:700;
                  letter-spacing:12px;margin:0;font-family:monospace;">
          {otp}
        </p>
        <p style="color:#9BAEC8;font-size:13px;margin:12px 0 0 0;">
          Expires in 10 minutes
        </p>
      </div>

      <p style="color:#9BAEC8;font-size:13px;text-align:center;margin:0;">
        If you did not request this, you can safely ignore this email.
      </p>
    """
    payload = {
        "from": f"EduMag NG <{settings.FROM_EMAIL}>",
        "to": [to_email],
        "subject": "Verify your email — EduMag NG",
        "html": _base_html("Verify your email", body_html),
    }
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: resend.Emails.send(payload))
        logger.info("OTP email sent to %s (id=%s)", to_email, _get_id(result))
    except Exception:
        logger.exception("Failed to send OTP email to %s", to_email)


async def send_welcome_email(to_email: str, name: str, school_name: str) -> None:
    logger.info("Sending welcome email to %s for school '%s'", to_email, school_name)
    dashboard_url = f"{settings.FRONTEND_URL}/dashboard/super-admin"
    body_html = f"""
      <p>Hello <strong>{name}</strong>,</p>
      <p>
        Welcome to <strong>EduMag NG</strong>! Your school,
        <strong>{school_name}</strong>, has been successfully registered.
      </p>
      <p>You can now log in and start managing your school:</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="{dashboard_url}"
           style="background:{_BRAND_COLOR};color:#ffffff;text-decoration:none;
                  padding:14px 32px;border-radius:6px;font-size:15px;
                  font-weight:bold;display:inline-block;">
          Go to Dashboard
        </a>
      </p>
      <p>Here's what you can do to get started:</p>
      <ul style="padding-left:20px;color:#374151;">
        <li>Set up your school terms and academic sessions</li>
        <li>Add your grading system</li>
        <li>Create classes and invite staff members</li>
        <li>Enrol students</li>
      </ul>
      <p>
        If you have any questions, reply to this email and our support team
        will be happy to help.
      </p>
      <p>Welcome aboard!</p>
    """
    payload = {
        "from": f"EduMag NG <{settings.FROM_EMAIL}>",
        "to": [to_email],
        "subject": f"Welcome to EduMag NG — {school_name} is ready",
        "html": _base_html("Welcome to EduMag NG", body_html),
    }
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: resend.Emails.send(payload))
        logger.info("Welcome email sent to %s (id=%s)", to_email, _get_id(result))
    except Exception:
        logger.exception("Failed to send welcome email to %s", to_email)
