import { Platform, Share } from 'react-native';

import {
  ApiError,
  apiUserToAppUser,
  createTicket,
  exportManagerCsv,
  fetchComments,
  fetchNotifications,
  fetchTicketHistory,
  fetchTickets,
  getCurrentUser,
  listUsers,
  loginUser,
  markNotificationRead,
  postComment,
  registerUser,
  updateTicket,
  updateUser,
  uploadFile,
  type ApiUser,
} from '@/api/client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('api/client', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const originalPlatformOS = Platform.OS;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalEnv;
    }
    Platform.OS = originalPlatformOS;
    jest.restoreAllMocks();
  });

  describe('base URL resolution', () => {
    it('uses EXPO_PUBLIC_API_URL, stripping a trailing slash, when set', async () => {
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/';
      fetchMock.mockResolvedValue(jsonResponse(200, { id: '1' }));
      await getCurrentUser('tok');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/users/me');
    });

    it('falls back to localhost when unset and not on Android', async () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      Platform.OS = 'ios';
      fetchMock.mockResolvedValue(jsonResponse(200, { id: '1' }));
      await getCurrentUser('tok');
      expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/v1/users/me');
    });

    it('falls back to the Android emulator alias when unset on Android', async () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      Platform.OS = 'android';
      fetchMock.mockResolvedValue(jsonResponse(200, { id: '1' }));
      await getCurrentUser('tok');
      expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.2.2:8000/api/v1/users/me');
    });
  });

  describe('loginUser', () => {
    it('POSTs form-encoded credentials with no auth header and returns the access token', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'tok-123' }));
      const token = await loginUser('a@b.com', 'secret');
      expect(token).toBe('tok-123');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/auth/login');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(options.body).toBe('username=a%40b.com&password=secret');
      expect(options.headers.Authorization).toBeUndefined();
    });
  });

  describe('registerUser', () => {
    it('POSTs the payload as JSON', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1' }));
      const payload = {
        name: 'A',
        email: 'a@b.com',
        phone: '123',
        role: 'resident' as const,
        password: 'secret123',
      };
      await registerUser(payload);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/auth/register');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual(payload);
    });
  });

  describe('getCurrentUser / updateUser', () => {
    it('getCurrentUser sends the bearer token as a GET', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1' }));
      await getCurrentUser('tok-abc');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/users/me');
      expect(options.method ?? 'GET').toBe('GET');
      expect(options.headers.Authorization).toBe('Bearer tok-abc');
    });

    it('updateUser PATCHes only the given partial payload', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', name: 'New' }));
      await updateUser('tok', 'u1', { name: 'New' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/users/u1');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ name: 'New' });
      expect(options.headers.Authorization).toBe('Bearer tok');
    });
  });

  describe('exportManagerCsv', () => {
    it('requests the manager export with auth and shares the returned CSV on native', async () => {
      Platform.OS = 'ios';
      const share = jest.spyOn(Share, 'share').mockResolvedValue({
        action: Share.sharedAction,
        activityType: null,
      });
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-disposition': 'attachment; filename="simplifix-residents-2026-08-12.csv"',
        }),
        text: async () => '\ufeffresident_id,name\r\nu1,Jane\r\n',
      } as Response);

      const filename = await exportManagerCsv('manager-token', 'residents');

      expect(filename).toBe('simplifix-residents-2026-08-12.csv');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/exports/residents.csv',
        { headers: { Authorization: 'Bearer manager-token' } },
      );
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: filename,
          message: '\ufeffresident_id,name\r\nu1,Jane\r\n',
        }),
        expect.objectContaining({ subject: filename }),
      );
    });
  });

  describe('createTicket / updateTicket / postComment payloads', () => {
    it('createTicket POSTs the ticket payload as JSON', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'tkt1' }));
      const payload = { title: 'Leaky faucet', category_id: 'cat1', resident_note: 'drip drip' };
      await createTicket('tok', payload);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/tickets/');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(payload);
    });

    it('updateTicket PATCHes only the given changes', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'tkt1' }));
      await updateTicket('tok', 'tkt1', { status: 'Assigned', worker_id: 'w1' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/tickets/tkt1');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ status: 'Assigned', worker_id: 'w1' });
    });

    it('postComment POSTs the message as JSON', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'c1' }));
      await postComment('tok', 'tkt1', 'Any update?');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/tickets/tkt1/comments');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ message: 'Any update?' });
    });
  });

  describe.each([
    { name: 'listUsers', call: () => listUsers('tok'), path: '/api/v1/users/', method: 'GET' },
    {
      name: 'fetchTickets',
      call: () => fetchTickets('tok'),
      path: '/api/v1/tickets/',
      method: 'GET',
    },
    {
      name: 'fetchTicketHistory',
      call: () => fetchTicketHistory('tok', 'tkt1'),
      path: '/api/v1/tickets/tkt1/history',
      method: 'GET',
    },
    {
      name: 'fetchComments',
      call: () => fetchComments('tok', 'tkt1'),
      path: '/api/v1/tickets/tkt1/comments',
      method: 'GET',
    },
    {
      name: 'fetchNotifications',
      call: () => fetchNotifications('tok'),
      path: '/api/v1/notifications/me',
      method: 'GET',
    },
    {
      name: 'markNotificationRead',
      call: () => markNotificationRead('tok', 'ntf1'),
      path: '/api/v1/notifications/ntf1/read',
      method: 'PATCH',
    },
  ])('$name', ({ call, path, method }) => {
    it(`calls ${method} ${path} with the bearer token`, async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, {}));
      await call();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.example.com${path}`);
      expect(options.method ?? 'GET').toBe(method);
      expect(options.headers.Authorization).toBe('Bearer tok');
    });
  });

  describe('error handling', () => {
    it('throws an ApiError with the string `detail` message from the response body', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Incorrect email or password' }));
      await expect(loginUser('a@b.com', 'bad')).rejects.toBeInstanceOf(ApiError);
      fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Incorrect email or password' }));
      await expect(loginUser('a@b.com', 'bad')).rejects.toMatchObject({
        status: 401,
        message: 'Incorrect email or password',
      });
    });

    it('joins an array of `detail` validation errors into one message', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(422, { detail: [{ msg: 'field required' }, { msg: 'too short' }] }),
      );
      await expect(loginUser('a@b.com', 'bad')).rejects.toMatchObject({
        status: 422,
        message: 'field required; too short',
      });
    });

    it('falls back to a generic message when the error body is not valid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      });
      await expect(loginUser('a@b.com', 'bad')).rejects.toMatchObject({
        status: 500,
        message: 'Request failed with status 500',
      });
    });
  });

  describe('204 No Content responses', () => {
    it('resolves to undefined without parsing the response body', async () => {
      const json = jest.fn();
      fetchMock.mockResolvedValue({ ok: true, status: 204, json });
      const result = await getCurrentUser('tok');
      expect(result).toBeUndefined();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    it('on native platforms, sends a single multipart request with the auth header and kind field', async () => {
      Platform.OS = 'ios';
      fetchMock.mockResolvedValue(jsonResponse(200, { url: 'https://cdn.example.com/a.jpg' }));

      const result = await uploadFile('tok', 'file:///path/to/photo.jpg', 'photo');

      expect(result).toEqual({ url: 'https://cdn.example.com/a.jpg' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/uploads/');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer tok');
      expect((options.body as FormData).get('kind')).toBe('photo');
    });

    it('on web, first resolves the local URI to a blob, then uploads it', async () => {
      Platform.OS = 'web';
      const fakeBlob = new Blob(['data'], { type: 'image/jpeg' });
      fetchMock
        .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => fakeBlob })
        .mockResolvedValueOnce(jsonResponse(200, { url: 'https://cdn.example.com/a.jpg' }));

      const result = await uploadFile('tok', 'blob:local-uri', 'photo');

      expect(result).toEqual({ url: 'https://cdn.example.com/a.jpg' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('blob:local-uri');
      const [uploadUrl, options] = fetchMock.mock.calls[1];
      expect(uploadUrl).toBe('https://api.example.com/api/v1/uploads/');
      expect((options.body as FormData).get('kind')).toBe('photo');
    });

    it('throws an ApiError when the upload request fails', async () => {
      Platform.OS = 'ios';
      fetchMock.mockResolvedValue(jsonResponse(413, { detail: 'File too large' }));
      await expect(uploadFile('tok', 'file:///a.jpg', 'photo')).rejects.toMatchObject({
        status: 413,
        message: 'File too large',
      });
    });
  });

  describe('apiUserToAppUser', () => {
    const base: ApiUser = {
      id: 'u1',
      name: 'Jane',
      email: 'jane@x.com',
      phone: '123',
      role: 'resident',
      avatar_color: '#fff',
      avatar_uri: null,
      apartment_id: 'apt1',
      title: null,
      specialization: null,
      account_status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      active_jobs: null,
      rating: null,
    };

    it('maps a resident, carrying the apartment id through', () => {
      expect(apiUserToAppUser(base)).toEqual({
        userId: 'u1',
        name: 'Jane',
        email: 'jane@x.com',
        phone: '123',
        avatarColor: '#fff',
        avatarUri: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        accountStatus: 'active',
        role: 'resident',
        apartmentId: 'apt1',
      });
    });

    it('maps a resident with no apartment assigned yet to an empty string', () => {
      const user: ApiUser = { ...base, apartment_id: null };
      expect(apiUserToAppUser(user)).toMatchObject({ apartmentId: '' });
    });

    it('defaults a missing avatar_uri to undefined rather than null', () => {
      const user: ApiUser = { ...base, avatar_uri: 'https://cdn.example.com/me.png' };
      expect(apiUserToAppUser(user)).toMatchObject({
        avatarUri: 'https://cdn.example.com/me.png',
      });
    });

    it('maps a facility_manager, defaulting a missing title to an empty string', () => {
      const user: ApiUser = { ...base, role: 'facility_manager', title: null };
      expect(apiUserToAppUser(user)).toMatchObject({ role: 'facility_manager', title: '' });
    });

    it('maps an admin to a bare admin AppUser', () => {
      const user: ApiUser = { ...base, role: 'admin' };
      expect(apiUserToAppUser(user)).toEqual({
        userId: 'u1',
        name: 'Jane',
        email: 'jane@x.com',
        phone: '123',
        avatarColor: '#fff',
        avatarUri: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        accountStatus: 'active',
        role: 'admin',
      });
    });

    it('maps a facility_employee, keeping a present title', () => {
      const user: ApiUser = { ...base, role: 'facility_employee', title: 'Supervisor' };
      expect(apiUserToAppUser(user)).toMatchObject({
        role: 'facility_employee',
        title: 'Supervisor',
      });
    });

    it('maps maintenance_staff, defaulting missing fields to empty/zero', () => {
      const user: ApiUser = {
        ...base,
        role: 'maintenance_staff',
        specialization: null,
        active_jobs: null,
        rating: null,
      };
      expect(apiUserToAppUser(user)).toMatchObject({
        role: 'maintenance_staff',
        specialization: '',
        activeJobs: 0,
        rating: 0,
      });
    });

    it('maps maintenance_staff, keeping present specialization/activeJobs/rating', () => {
      const user: ApiUser = {
        ...base,
        role: 'maintenance_staff',
        specialization: 'Electrical',
        active_jobs: 3,
        rating: 4.5,
      };
      expect(apiUserToAppUser(user)).toMatchObject({
        role: 'maintenance_staff',
        specialization: 'Electrical',
        activeJobs: 3,
        rating: 4.5,
      });
    });

    it('throws for an unrecognized role', () => {
      const user = { ...base, role: 'unknown-role' } as unknown as ApiUser;
      expect(() => apiUserToAppUser(user)).toThrow('Unknown user role: unknown-role');
    });
  });
});
