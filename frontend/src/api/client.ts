import { Platform } from 'react-native';

import type {
  AccountStatus,
  AppUser,
  CostResponsibility,
  MediaType,
  Priority,
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
      return body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ');
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
