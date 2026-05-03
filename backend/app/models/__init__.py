from app.models.school import School
from app.models.user import User
from app.models.school_membership import SchoolMembership
from app.models.student import Student
from app.models.parent import Parent
from app.models.class_ import Class
from app.models.attendance import Attendance
from app.models.result import Result
from app.models.finance import Payment
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.communication import Announcement, Message
from app.models.school_term import SchoolTerm
from app.models.grading_system import GradingSystem
from app.models.refresh_token import RefreshToken
from app.models.email_verification import EmailVerification

__all__ = [
    "School",
    "User",
    "SchoolMembership",
    "Student",
    "Parent",
    "Class",
    "Attendance",
    "Result",
    "Payment",
    "Assignment",
    "AssignmentSubmission",
    "Announcement",
    "Message",
    "SchoolTerm",
    "GradingSystem",
    "RefreshToken",
    "EmailVerification",
]
