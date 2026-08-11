import { Platform } from 'react-native';

import type {
  AccountStatus,
  AppUser,
  CostResponsibility,
  MediaType,
  Notice,
  NoticeTower,
  Priority,
  PublicService,
  PublicServiceComment,
  PublicServiceStatus,
  PublicSimilaritySuggestion,
  TicketStatus,
  UserRole,
} from '@/types';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar_color: string;
  avatar_uri: string | null;
  apartment_id: string | null;
  title: string | null;
  specialization: string | null;
  account_status: AccountStatus;
  created_at: string;
  active_jobs: number | null;
  rating: number | null;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password: string;
  building?: string;
  unit_number?: string;
  title?: string;
  specialization?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  avatar_color?: string;
  avatar_uri?: string;
  account_status?: AccountStatus;
  title?: string;
  specialization?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Android emulator's alias for the host machine's localhost.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((d: { msg?: string }) => d.msg)
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    // fall through to generic message
  }
  return `Request failed with status ${response.status}`;
}

async function apiFetch<T>(
  path: string,
  options: { method?: string; token?: string; json?: unknown; form?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: string | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function apiUserToAppUser(user: ApiUser): AppUser {
  const base = {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarColor: user.avatar_color,
    avatarUri: user.avatar_uri ?? undefined,
    createdAt: user.created_at,
    accountStatus: user.account_status,
  };

  switch (user.role) {
    case 'resident':
      return { ...base, role: 'resident', apartmentId: user.apartment_id ?? '' };
    case 'facility_manager':
      return { ...base, role: 'facility_manager', title: user.title ?? '' };
    case 'facility_employee':
      return { ...base, role: 'facility_employee', title: user.title ?? '' };
    case 'maintenance_staff':
      return {
        ...base,
        role: 'maintenance_staff',
        specialization: user.specialization ?? '',
        activeJobs: user.active_jobs ?? 0,
        rating: user.rating ?? 0,
      };
    default: {
      const exhaustiveCheck: never = user.role;
      throw new Error(`Unknown user role: ${exhaustiveCheck}`);
    }
  }
}

export async function registerUser(payload: RegisterPayload): Promise<ApiUser> {
  return apiFetch<ApiUser>('/api/v1/auth/register', { method: 'POST', json: payload });
}

export async function loginUser(email: string, password: string): Promise<string> {
  const { access_token: accessToken } = await apiFetch<{ access_token: string }>(
    '/api/v1/auth/login',
    { method: 'POST', form: { username: email, password } },
  );
  return accessToken;
}

export async function sendOtp(
  email: string,
  purpose: 'register' | 'forgot_password',
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/v1/auth/send-otp', {
    method: 'POST',
    json: { email, purpose },
  });
}

export async function verifyOtp(
  email: string,
  otp: string,
  purpose: 'register' | 'forgot_password',
): Promise<{ verified: boolean; reset_token?: string }> {
  return apiFetch<{ verified: boolean; reset_token?: string }>('/api/v1/auth/verify-otp', {
    method: 'POST',
    json: { email, otp, purpose },
  });
}

export async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/v1/auth/reset-password', {
    method: 'POST',
    json: { reset_token: resetToken, new_password: newPassword },
  });
}

export async function sendChangePasswordOtp(
  token: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/v1/auth/change-password/send-otp', {
    method: 'POST',
    token,
    json: {},
  });
}

export async function verifyAndChangePassword(
  token: string,
  otp: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/v1/auth/change-password/verify-and-change', {
    method: 'POST',
    token,
    json: { otp, current_password: currentPassword, new_password: newPassword },
  });
}

export async function getCurrentUser(token: string): Promise<ApiUser> {
  return apiFetch<ApiUser>('/api/v1/users/me', { token });
}

export async function listUsers(token: string): Promise<ApiUser[]> {
  return apiFetch<ApiUser[]>('/api/v1/users/', { token });
}

export async function updateUser(
  token: string,
  userId: string,
  patch: UpdateUserPayload,
): Promise<ApiUser> {
  return apiFetch<ApiUser>(`/api/v1/users/${userId}`, { method: 'PATCH', token, json: patch });
}

export type UploadKind = 'photo' | 'voice_note';

const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/m4a',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
};

export async function uploadFile(
  token: string,
  localUri: string,
  kind: UploadKind,
): Promise<{ url: string }> {
  const filename = localUri.split('/').pop() ?? `${kind}-${Date.now()}`;
  const extension = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase();
  const type =
    (extension && UPLOAD_MIME_BY_EXTENSION[extension]) ??
    (kind === 'photo' ? 'image/jpeg' : 'audio/m4a');

  const formData = new FormData();
  if (Platform.OS === 'web') {
    // On web, `uri` is a blob:/data: URL and the DOM FormData only accepts a real Blob/File —
    // passing the {uri, name, type} descriptor gets silently stringified to "[object Object]".
    const blob = await (await fetch(localUri)).blob();
    formData.append('file', blob, filename);
  } else {
    // React Native's fetch accepts this file-descriptor shape for FormData, which isn't
    // representable by the DOM Blob type FormData.append() expects.
    formData.append('file', { uri: localUri, name: filename, type } as unknown as Blob);
  }
  formData.append('kind', kind);

  const response = await fetch(`${getApiBaseUrl()}/api/v1/uploads/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  return (await response.json()) as { url: string };
}

export interface ApiTicketMedia {
  id: string;
  ticket_id: string;
  media_url: string;
  media_type: MediaType;
  uploaded_at: string;
}

export interface CreateTicketPayload {
  title: string;
  category_id: string;
  resident_note?: string;
  voice_note_url?: string | null;
  voice_note_duration_sec?: number | null;
  photo_urls?: string[];
  priority?: Priority | null;
  ai_description?: string | null;
  ai_confidence?: number | null;
}

export interface ApiTicket {
  id: string;
  resident_id: string;
  worker_id: string | null;
  category_id: string;
  title: string;
  resident_note: string;
  image_url: string | null;
  media_type: MediaType | null;
  voice_note_url: string | null;
  voice_note_duration_sec: number | null;
  ai_description: string;
  ai_confidence: number;
  priority: Priority;
  status: TicketStatus;
  cost_responsibility: CostResponsibility;
  date_of_request: string;
  date_of_resolution: string | null;
  resolution_remarks: string | null;
  resolution_proof_url: string | null;
  resident_rating: number | null;
  resident_feedback: string | null;
  is_overdue: boolean;
  media: ApiTicketMedia[];
}

export async function createTicket(
  token: string,
  payload: CreateTicketPayload,
): Promise<ApiTicket> {
  return apiFetch<ApiTicket>('/api/v1/tickets/', { method: 'POST', token, json: payload });
}

export interface ComplaintAnalysisPayload {
  resident_note: string;
  photo_urls?: string[];
  voice_note_url?: string | null;
}

export interface ComplaintAnalysisResponse {
  ai_description: string;
  category_id: string;
  priority: Priority;
  confidence: number;
}

/** Calls the server-side Gemini gateway; the Gemini key never reaches the client. */
export async function analyzeComplaint(
  token: string,
  payload: ComplaintAnalysisPayload,
): Promise<ComplaintAnalysisResponse> {
  return apiFetch<ComplaintAnalysisResponse>('/api/v1/ai/analyze-complaint', {
    method: 'POST',
    token,
    json: payload,
  });
}

export interface ResidentChatMessage {
  role: 'resident' | 'assistant';
  text: string;
}

export interface ResidentChatResponse {
  reply: string;
  related_ticket_id: string | null;
  suggestions: string[];
}

export async function askResidentAssistant(
  token: string,
  payload: { message: string; history: ResidentChatMessage[] },
): Promise<ResidentChatResponse> {
  return apiFetch<ResidentChatResponse>('/api/v1/ai/resident-chat', {
    method: 'POST',
    token,
    json: payload,
  });
}

export interface ApiChatMessage {
  id: string;
  role: 'resident' | 'assistant';
  text: string;
  related_ticket_id: string | null;
  suggestions: string[] | null;
  created_at: string;
}

export async function fetchChatHistory(token: string): Promise<ApiChatMessage[]> {
  return apiFetch<ApiChatMessage[]>('/api/v1/ai/chat-history', { token });
}

export async function clearChatHistory(token: string): Promise<void> {
  await apiFetch<void>('/api/v1/ai/chat-history', { method: 'DELETE', token });
}

export async function fetchDashboardSummary(token: string): Promise<string> {
  const { summary } = await apiFetch<{ summary: string }>('/api/v1/ai/dashboard-summary', {
    token,
  });
  return summary;
}

export async function fetchTickets(token: string): Promise<ApiTicket[]> {
  return apiFetch<ApiTicket[]>('/api/v1/tickets/', { token });
}

export interface ApiTicketHistoryEntry {
  id: string;
  ticket_id: string;
  old_status: TicketStatus | null;
  new_status: TicketStatus;
  remarks: string;
  changed_at: string;
  actor_id: string | null;
}

export async function fetchTicketHistory(
  token: string,
  ticketId: string,
): Promise<ApiTicketHistoryEntry[]> {
  return apiFetch<ApiTicketHistoryEntry[]>(`/api/v1/tickets/${ticketId}/history`, { token });
}

export interface UpdateTicketPayload {
  category_id?: string | null;
  worker_id?: string | null;
  priority?: Priority | null;
  status?: TicketStatus | null;
  cost_responsibility?: CostResponsibility | null;
  resolution_remarks?: string | null;
  resolution_proof_url?: string | null;
  resident_rating?: number | null;
  resident_feedback?: string | null;
}

export async function updateTicket(
  token: string,
  ticketId: string,
  payload: UpdateTicketPayload,
): Promise<ApiTicket> {
  return apiFetch<ApiTicket>(`/api/v1/tickets/${ticketId}`, {
    method: 'PATCH',
    token,
    json: payload,
  });
}

export interface ApiComment {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  posted_at: string;
}

export async function fetchComments(token: string, ticketId: string): Promise<ApiComment[]> {
  return apiFetch<ApiComment[]>(`/api/v1/tickets/${ticketId}/comments`, { token });
}

export async function postComment(
  token: string,
  ticketId: string,
  message: string,
): Promise<ApiComment> {
  return apiFetch<ApiComment>(`/api/v1/tickets/${ticketId}/comments`, {
    method: 'POST',
    token,
    json: { message },
  });
}

export interface ApiNotification {
  id: string;
  user_id: string;
  ticket_id: string | null;
  public_service_id?: string | null;
  notice_id?: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ApiNotice {
  id: string;
  created_by_id: string;
  title: string;
  body: string;
  brief_points: string[];
  target_buildings: string[];
  status: Notice['status'];
  timezone: string;
  scheduled_at: string | null;
  sent_at: string | null;
  expires_at: string | null;
  recipient_count: number;
  created_at: string;
  updated_at: string;
}

function mapApiNotice(value: ApiNotice): Notice {
  return {
    id: value.id,
    createdById: value.created_by_id,
    title: value.title,
    body: value.body,
    briefPoints: value.brief_points,
    targetBuildings: value.target_buildings,
    status: value.status,
    timezone: value.timezone,
    scheduledAt: value.scheduled_at,
    sentAt: value.sent_at,
    expiresAt: value.expires_at,
    recipientCount: value.recipient_count,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export interface SaveNoticePayload {
  title: string;
  body: string;
  brief_points: string[];
  target_buildings: string[];
  timezone: string;
  expires_at: string | null;
}

export async function fetchNotices(token: string): Promise<Notice[]> {
  return (await apiFetch<ApiNotice[]>('/api/v1/notices/', { token })).map(mapApiNotice);
}

export async function fetchNotice(token: string, id: string): Promise<Notice> {
  return mapApiNotice(await apiFetch<ApiNotice>(`/api/v1/notices/${id}`, { token }));
}

export async function fetchNoticeTowers(token: string): Promise<NoticeTower[]> {
  const values = await apiFetch<{ building: string; resident_count: number }[]>(
    '/api/v1/notices/towers',
    { token },
  );
  return values.map((value) => ({
    building: value.building,
    residentCount: value.resident_count,
  }));
}

export async function createNotice(token: string, payload: SaveNoticePayload): Promise<Notice> {
  return mapApiNotice(
    await apiFetch<ApiNotice>('/api/v1/notices/', { method: 'POST', token, json: payload }),
  );
}

export async function updateNotice(
  token: string,
  id: string,
  payload: SaveNoticePayload,
): Promise<Notice> {
  return mapApiNotice(
    await apiFetch<ApiNotice>(`/api/v1/notices/${id}`, {
      method: 'PATCH',
      token,
      json: payload,
    }),
  );
}

export async function draftNotice(
  token: string,
  payload: {
    brief_points: string[];
    target_buildings: string[];
    scheduled_at: string | null;
    expires_at: string | null;
    timezone: string;
  },
): Promise<{ title: string; body: string }> {
  return apiFetch<{ title: string; body: string }>('/api/v1/ai/draft-notice', {
    method: 'POST',
    token,
    json: payload,
  });
}

export async function sendNotice(token: string, id: string): Promise<Notice> {
  return mapApiNotice(
    await apiFetch<ApiNotice>(`/api/v1/notices/${id}/send`, { method: 'POST', token }),
  );
}

export async function scheduleNotice(
  token: string,
  id: string,
  scheduledAt: string,
): Promise<Notice> {
  return mapApiNotice(
    await apiFetch<ApiNotice>(`/api/v1/notices/${id}/schedule`, {
      method: 'POST',
      token,
      json: { scheduled_at: scheduledAt },
    }),
  );
}

export async function cancelNotice(token: string, id: string): Promise<Notice> {
  return mapApiNotice(
    await apiFetch<ApiNotice>(`/api/v1/notices/${id}/cancel`, { method: 'POST', token }),
  );
}

interface ApiPublicReport {
  id: string;
  author_id: string;
  author_name: string;
  author_building: string | null;
  title: string;
  description: string;
  location: string;
  created_at: string;
  media: { id: string; media_url: string; uploaded_at: string }[];
}

export interface ApiPublicService {
  id: string;
  created_by_id: string;
  creator_name: string;
  creator_building: string | null;
  worker_id: string | null;
  category_id: string;
  title: string;
  description: string;
  location: string;
  ai_summary: string;
  priority: Priority;
  status: PublicServiceStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_remarks: string | null;
  resolution_proof_url: string | null;
  merged_into_id: string | null;
  reports: ApiPublicReport[];
  comment_count: number;
}

export interface ApiPublicComment {
  id: string;
  service_id: string;
  user_id: string;
  author_name: string;
  author_role: UserRole;
  message: string;
  posted_at: string;
}

interface ApiPublicSuggestion {
  id: string;
  service_a: ApiPublicService;
  service_b: ApiPublicService;
  score: number;
  rationale: string;
  model_name: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  merged_service_id: string | null;
  created_at: string;
}

export function mapApiPublicService(value: ApiPublicService): PublicService {
  return {
    id: value.id,
    createdById: value.created_by_id,
    creatorName: value.creator_name,
    creatorBuilding: value.creator_building,
    workerId: value.worker_id,
    categoryId: value.category_id,
    title: value.title,
    description: value.description,
    location: value.location,
    aiSummary: value.ai_summary,
    priority: value.priority,
    status: value.status,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    resolvedAt: value.resolved_at,
    resolutionRemarks: value.resolution_remarks,
    resolutionProofUrl: value.resolution_proof_url,
    mergedIntoId: value.merged_into_id,
    commentCount: value.comment_count,
    reports: value.reports.map((report) => ({
      id: report.id,
      authorId: report.author_id,
      authorName: report.author_name,
      authorBuilding: report.author_building,
      title: report.title,
      description: report.description,
      location: report.location,
      createdAt: report.created_at,
      media: report.media.map((media) => ({
        id: media.id,
        mediaUrl: media.media_url,
        uploadedAt: media.uploaded_at,
      })),
    })),
  };
}

function mapApiPublicComment(value: ApiPublicComment): PublicServiceComment {
  return {
    id: value.id,
    serviceId: value.service_id,
    userId: value.user_id,
    authorName: value.author_name,
    authorRole: value.author_role,
    message: value.message,
    postedAt: value.posted_at,
  };
}

function mapApiSuggestion(value: ApiPublicSuggestion): PublicSimilaritySuggestion {
  return {
    id: value.id,
    serviceA: mapApiPublicService(value.service_a),
    serviceB: mapApiPublicService(value.service_b),
    score: value.score,
    rationale: value.rationale,
    modelName: value.model_name,
    status: value.status,
    reviewedById: value.reviewed_by_id,
    reviewedAt: value.reviewed_at,
    mergedServiceId: value.merged_service_id,
    createdAt: value.created_at,
  };
}

export async function fetchPublicServices(token: string): Promise<PublicService[]> {
  const values = await apiFetch<ApiPublicService[]>('/api/v1/public-services/', { token });
  return values.map(mapApiPublicService);
}

export async function fetchPublicService(token: string, id: string): Promise<PublicService> {
  return mapApiPublicService(
    await apiFetch<ApiPublicService>(`/api/v1/public-services/${id}`, { token }),
  );
}

export async function createPublicService(
  token: string,
  payload: {
    title: string;
    description: string;
    location: string;
    category_id: string;
    priority: Priority;
    photo_urls?: string[];
  },
): Promise<PublicService> {
  return mapApiPublicService(
    await apiFetch<ApiPublicService>('/api/v1/public-services/', {
      method: 'POST',
      token,
      json: payload,
    }),
  );
}

export async function updatePublicService(
  token: string,
  id: string,
  patch: {
    worker_id?: string | null;
    category_id?: string;
    priority?: Priority;
    status?: PublicServiceStatus;
    resolution_remarks?: string;
    resolution_proof_url?: string;
  },
): Promise<PublicService> {
  return mapApiPublicService(
    await apiFetch<ApiPublicService>(`/api/v1/public-services/${id}`, {
      method: 'PATCH',
      token,
      json: patch,
    }),
  );
}

export async function fetchPublicComments(
  token: string,
  serviceId: string,
): Promise<PublicServiceComment[]> {
  const values = await apiFetch<ApiPublicComment[]>(
    `/api/v1/public-services/${serviceId}/comments`,
    { token },
  );
  return values.map(mapApiPublicComment);
}

export async function createPublicComment(
  token: string,
  serviceId: string,
  message: string,
): Promise<PublicServiceComment> {
  return mapApiPublicComment(
    await apiFetch<ApiPublicComment>(`/api/v1/public-services/${serviceId}/comments`, {
      method: 'POST',
      token,
      json: { message },
    }),
  );
}

export async function fetchSimilaritySuggestions(
  token: string,
): Promise<PublicSimilaritySuggestion[]> {
  const values = await apiFetch<ApiPublicSuggestion[]>(
    '/api/v1/public-services/similarity/suggestions',
    { token },
  );
  return values.map(mapApiSuggestion);
}

export async function reviewSimilaritySuggestion(
  token: string,
  suggestionId: string,
  accept: boolean,
): Promise<PublicSimilaritySuggestion> {
  return mapApiSuggestion(
    await apiFetch<ApiPublicSuggestion>(
      `/api/v1/public-services/similarity/suggestions/${suggestionId}/review`,
      { method: 'POST', token, json: { accept } },
    ),
  );
}

export async function fetchNotifications(token: string): Promise<ApiNotification[]> {
  return apiFetch<ApiNotification[]>('/api/v1/notifications/me', { token });
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
): Promise<ApiNotification> {
  return apiFetch<ApiNotification>(`/api/v1/notifications/${notificationId}/read`, {
    method: 'PATCH',
    token,
  });
}
