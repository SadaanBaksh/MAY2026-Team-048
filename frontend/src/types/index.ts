export type UserRole = 'resident' | 'facility_employee' | 'maintenance_staff' | 'facility_manager';

export type AccountStatus = 'active' | 'pending' | 'rejected';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical' | 'Emergency';

export type TicketStatus = 'Pending' | 'Assigned' | 'In_Progress' | 'Resolved' | 'Closed' | 'Cancelled';

export type PublicServiceStatus = 'Pending' | 'Assigned' | 'In_Progress' | 'Resolved' | 'Merged';

export type NoticeStatus = 'Draft' | 'Scheduled' | 'Sent' | 'Expired' | 'Cancelled';

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
  avatarUri?: string;
  createdAt: string;
  accountStatus: AccountStatus;
}

export interface Resident extends BaseUser {
  role: 'resident';
  apartmentId: string;
  building?: string;
  unitNumber?: string;
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
  publicServiceId?: string;
  noticeId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Notice {
  id: string;
  createdById: string;
  title: string;
  body: string;
  briefPoints: string[];
  targetBuildings: string[];
  status: NoticeStatus;
  timezone: string;
  scheduledAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeTower {
  building: string;
  residentCount: number;
}

export interface PublicReportMedia {
  id: string;
  mediaUrl: string;
  uploadedAt: string;
}

export interface PublicReport {
  id: string;
  authorId: string;
  authorName: string;
  authorBuilding: string | null;
  title: string;
  description: string;
  location: string;
  createdAt: string;
  media: PublicReportMedia[];
}

export interface PublicService {
  id: string;
  createdById: string;
  creatorName: string;
  creatorBuilding: string | null;
  workerId: string | null;
  categoryId: string;
  title: string;
  description: string;
  location: string;
  aiSummary: string;
  priority: Priority;
  status: PublicServiceStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionRemarks: string | null;
  resolutionProofUrl: string | null;
  mergedIntoId: string | null;
  reports: PublicReport[];
  commentCount: number;
}

export interface PublicServiceComment {
  id: string;
  serviceId: string;
  userId: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  postedAt: string;
}

export interface PublicSimilaritySuggestion {
  id: string;
  serviceA: PublicService;
  serviceB: PublicService;
  score: number;
  rationale: string;
  modelName: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  reviewedById: string | null;
  reviewedAt: string | null;
  mergedServiceId: string | null;
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
  voiceNoteUrl: string | null;
  voiceNoteDurationSec: number | null;
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
