import enum


class UserRole(str, enum.Enum):
    resident = "resident"
    facility_employee = "facility_employee"
    maintenance_staff = "maintenance_staff"
    facility_manager = "facility_manager"
    # Platform operator. Not a self-registerable role — seeded via scripts.seed_demo_users
    # and used only by the admin endpoints that CRUD facility-manager accounts.
    admin = "admin"


class AccountStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    rejected = "rejected"
    # Set by a facility manager to revoke access from an account that was previously
    # active (resident / employee / maintenance staff). Distinct from `rejected`, which
    # means a registration request was declined and access was never granted.
    suspended = "suspended"


class Priority(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"
    Critical = "Critical"
    Emergency = "Emergency"


class TicketStatus(str, enum.Enum):
    Pending = "Pending"
    Assigned = "Assigned"
    In_Progress = "In_Progress"
    Resolved = "Resolved"
    Closed = "Closed"
    Cancelled = "Cancelled"
    Rejected = "Rejected"


class PublicServiceStatus(str, enum.Enum):
    Pending = "Pending"
    Assigned = "Assigned"
    In_Progress = "In_Progress"
    Resolved = "Resolved"
    Merged = "Merged"
    Rejected = "Rejected"


class NoticeStatus(str, enum.Enum):
    Draft = "Draft"
    Scheduled = "Scheduled"
    Sent = "Sent"
    Expired = "Expired"
    Cancelled = "Cancelled"


class SimilaritySuggestionStatus(str, enum.Enum):
    Pending = "Pending"
    Accepted = "Accepted"
    Declined = "Declined"


class MediaType(str, enum.Enum):
    Image = "Image"
    Video = "Video"


class CostResponsibility(str, enum.Enum):
    Owner = "Owner"
    Resident = "Resident"
    Society = "Society"
    Pending_Review = "Pending Review"
