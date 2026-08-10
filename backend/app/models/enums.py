import enum


class UserRole(str, enum.Enum):
    resident = "resident"
    facility_employee = "facility_employee"
    maintenance_staff = "maintenance_staff"
    facility_manager = "facility_manager"


class AccountStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    rejected = "rejected"


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


class PublicServiceStatus(str, enum.Enum):
    Pending = "Pending"
    Assigned = "Assigned"
    In_Progress = "In_Progress"
    Resolved = "Resolved"
    Merged = "Merged"


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
