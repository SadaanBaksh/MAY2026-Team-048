import { Platform } from 'react-native';

import type { AccountStatus, AppUser, UserRole } from '@/types';

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
