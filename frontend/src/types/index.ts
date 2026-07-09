export type UserRole =
  | 'resident'
  | 'facility_employee'
  | 'maintenance_staff'
  | 'facility_manager';

export type AccountStatus = 'active' | 'pending' | 'rejected';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TicketStatus = 'Pending' | 'Assigned' | 'In_Progress' | 'Resolved' | 'Closed';

export type MediaType = 'Image' | 'Video';

export type CostResponsibility = 'Owner' | 'Resident' | 'Society' | 'Pending Review';

export interface Apartment {
  apartmentId: string;
  unitNumber: string;
  building: string;
}

export interface BaseUser {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarColor: string;
  createdAt: string;
  accountStatus: AccountStatus;
}

export interface Resident extends BaseUser {
  role: 'resident';
  apartmentId: string;
}

export interface FacilityEmployee extends BaseUser {
  role: 'facility_employee';
  title: string;
}

export interface MaintenanceStaff extends BaseUser {
  role: 'maintenance_staff';
  specialization: string;
  activeJobs: number;
  rating: number;
}

export interface FacilityManager extends BaseUser {
  role: 'facility_manager';
  title: string;
}

export type AppUser = Resident | FacilityEmployee | MaintenanceStaff | FacilityManager;

export interface Category {
  categoryId: string;
  categoryName: string;
  icon: string;
}

export interface ComplaintMedia {
  mediaId: string;
  ticketId: string;
  mediaUrl: string;
  mediaType: MediaType;
  uploadedAt: string;
}

export interface ComplaintHistoryEntry {
  historyId: string;
  ticketId: string;
  oldStatus: TicketStatus | null;
  newStatus: TicketStatus;
  remarks: string;
  changedAt: string;
  actorName: string;
}

export interface Comment {
  commentId: string;
  ticketId: string;
  userId: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  postedAt: string;
}

export interface AppNotification {
  notificationId: string;
  userId: string;
  ticketId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Ticket {
  ticketId: string;
  residentId: string;
  workerId: string | null;
  categoryId: string;
  imageUrl: string | null;
  mediaType: MediaType | null;
  residentNote: string;
  aiDescription: string;
  aiConfidence: number;
  priority: Priority;
  status: TicketStatus;
  costResponsibility: CostResponsibility;
  dateOfRequest: string;
  dateOfResolution: string | null;
  resolutionRemarks: string | null;
  resolutionProofUrl: string | null;
  residentRating: number | null;
  residentFeedback: string | null;
  isOverdue: boolean;
  title: string;
}
