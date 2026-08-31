import {
  ApiError,
  getCurrentUser,
  listUsers,
  loginUser,
  registerUser,
  updateUser,
  verifyEmailChange,
  type ApiUser,
} from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import type { Resident } from '@/types';
import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    getCurrentUser: jest.fn(),
    listUsers: jest.fn(),
    loginUser: jest.fn(),
    registerUser: jest.fn(),
    updateUser: jest.fn(),
    verifyEmailChange: jest.fn(),
  };
});

jest.mock('@/utils/tokenStorage', () => ({
  getToken: jest.fn(),
  setToken: jest.fn(),
  clearToken: jest.fn(),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockListUsers = listUsers as jest.MockedFunction<typeof listUsers>;
const mockLoginUser = loginUser as jest.MockedFunction<typeof loginUser>;
const mockRegisterUser = registerUser as jest.MockedFunction<typeof registerUser>;
const mockUpdateUser = updateUser as jest.MockedFunction<typeof updateUser>;
const mockVerifyEmailChange = verifyEmailChange as jest.MockedFunction<typeof verifyEmailChange>;
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockSetToken = setToken as jest.MockedFunction<typeof setToken>;
const mockClearToken = clearToken as jest.MockedFunction<typeof clearToken>;

function buildApiUser(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
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
    ...overrides,
  };
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ currentUser: null, token: null, users: [], isHydrated: false });
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('on success, stores the token/current user and refreshes the roster', async () => {
      mockLoginUser.mockResolvedValue('tok-abc');
      mockGetCurrentUser.mockResolvedValue(buildApiUser());
      mockListUsers.mockResolvedValue([buildApiUser({ id: 'u1' }), buildApiUser({ id: 'u2' })]);

      const result = await useAuthStore.getState().login('jane@x.com', 'secret');

      expect(result).toEqual({ success: true });
      expect(mockSetToken).toHaveBeenCalledWith('tok-abc');
      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-abc');
      expect(state.currentUser?.userId).toBe('u1');
      expect(state.users.map((u) => u.userId)).toEqual(['u1', 'u2']);
    });

    it('on an ApiError, returns the error message without changing state', async () => {
      mockLoginUser.mockRejectedValue(new ApiError(401, 'Incorrect email or password'));

      const result = await useAuthStore.getState().login('jane@x.com', 'wrong');

      expect(result).toEqual({ success: false, error: 'Incorrect email or password' });
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().currentUser).toBeNull();
    });

    it('on a non-ApiError failure (e.g. network error), returns a generic message', async () => {
      mockLoginUser.mockRejectedValue(new TypeError('Network request failed'));

      const result = await useAuthStore.getState().login('jane@x.com', 'secret');

      expect(result).toEqual({
        success: false,
        error: 'Something went wrong. Please check your connection and try again.',
      });
    });
  });

  describe('loginAsDemo', () => {
    it.each([
      ['resident', 'demo.resident@simplifix.app'],
      ['facility_employee', 'demo.employee@simplifix.app'],
      ['maintenance_staff', 'demo.staff@simplifix.app'],
      ['facility_manager', 'demo.manager@simplifix.app'],
    ] as const)('delegates to login with the %s demo credentials', async (role, expectedEmail) => {
      mockLoginUser.mockRejectedValue(new ApiError(401, 'no such demo account seeded'));

      await useAuthStore.getState().loginAsDemo(role);

      expect(mockLoginUser).toHaveBeenCalledWith(expectedEmail, 'Demo@1234');
    });
  });

  describe('register', () => {
    it('maps unitNumber to unit_number, registers, then logs in on success', async () => {
      mockRegisterUser.mockResolvedValue(buildApiUser());
      mockLoginUser.mockResolvedValue('tok-new');
      mockGetCurrentUser.mockResolvedValue(buildApiUser());
      mockListUsers.mockResolvedValue([]);

      const result = await useAuthStore.getState().register({
        name: 'Jane',
        email: 'jane@x.com',
        phone: '123',
        role: 'resident',
        password: 'secret123',
        unitNumber: 'A-101',
      });

      expect(mockRegisterUser).toHaveBeenCalledWith({
        name: 'Jane',
        email: 'jane@x.com',
        phone: '123',
        role: 'resident',
        password: 'secret123',
        building: undefined,
        unit_number: 'A-101',
        title: undefined,
        specialization: undefined,
      });
      expect(mockLoginUser).toHaveBeenCalledWith('jane@x.com', 'secret123');
      expect(result).toEqual({ success: true });
    });

    it('returns the error and never calls login when registration itself fails', async () => {
      mockRegisterUser.mockRejectedValue(new ApiError(409, 'Email already registered'));

      const result = await useAuthStore.getState().register({
        name: 'Jane',
        email: 'jane@x.com',
        phone: '123',
        role: 'resident',
        password: 'secret123',
      });

      expect(result).toEqual({ success: false, error: 'Email already registered' });
      expect(mockLoginUser).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the token and resets session state', async () => {
      useAuthStore.setState({
        currentUser: apiUserFixtureAsAppUser(),
        token: 'tok-abc',
        users: [apiUserFixtureAsAppUser()],
      });

      await useAuthStore.getState().logout();

      expect(mockClearToken).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      expect(state.token).toBeNull();
      expect(state.users).toEqual([]);
    });
  });

  describe('updateCurrentUser', () => {
    it('does nothing when there is no signed-in user', async () => {
      await useAuthStore.getState().updateCurrentUser({ name: 'New Name' });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('PATCHes the mapped partial and updates currentUser + the matching roster entry', async () => {
      const currentUser = apiUserFixtureAsAppUser({ userId: 'u1', name: 'Old Name' });
      const otherUser = apiUserFixtureAsAppUser({ userId: 'u2', name: 'Other' });
      useAuthStore.setState({ currentUser, token: 'tok', users: [currentUser, otherUser] });
      mockUpdateUser.mockResolvedValue(
        buildApiUser({ id: 'u1', name: 'New Name', avatar_color: '#000' }),
      );

      await useAuthStore.getState().updateCurrentUser({ name: 'New Name', avatarColor: '#000' });

      expect(mockUpdateUser).toHaveBeenCalledWith('tok', 'u1', {
        name: 'New Name',
        avatar_color: '#000',
        avatar_uri: undefined,
      });
      const state = useAuthStore.getState();
      expect(state.currentUser?.name).toBe('New Name');
      expect(state.users.find((u) => u.userId === 'u1')?.name).toBe('New Name');
      expect(state.users.find((u) => u.userId === 'u2')?.name).toBe('Other');
    });
  });

  describe('confirmEmailChange', () => {
    it('does nothing when there is no signed-in user', async () => {
      await useAuthStore.getState().confirmEmailChange('new@x.com', '1234');
      expect(mockVerifyEmailChange).not.toHaveBeenCalled();
    });

    it('verifies the OTP and writes the new email onto currentUser + the roster', async () => {
      const currentUser = apiUserFixtureAsAppUser({ userId: 'u1', name: 'Jane' });
      useAuthStore.setState({ currentUser, token: 'tok', users: [currentUser] });
      mockVerifyEmailChange.mockResolvedValue(
        buildApiUser({ id: 'u1', name: 'Jane', email: 'new@x.com' }),
      );

      await useAuthStore.getState().confirmEmailChange('new@x.com', '1234');

      expect(mockVerifyEmailChange).toHaveBeenCalledWith('tok', 'new@x.com', '1234');
      const state = useAuthStore.getState();
      expect(state.currentUser?.email).toBe('new@x.com');
      expect(state.users.find((u) => u.userId === 'u1')?.email).toBe('new@x.com');
    });

    it('propagates an ApiError from a bad code', async () => {
      const currentUser = apiUserFixtureAsAppUser({ userId: 'u1' });
      useAuthStore.setState({ currentUser, token: 'tok', users: [currentUser] });
      mockVerifyEmailChange.mockRejectedValue(new ApiError(400, 'Invalid or expired OTP'));

      await expect(
        useAuthStore.getState().confirmEmailChange('new@x.com', '0000'),
      ).rejects.toThrow('Invalid or expired OTP');
    });
  });

  describe('approveUser / rejectUser', () => {
    it('does nothing without a token', async () => {
      await useAuthStore.getState().approveUser('u2');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('approveUser PATCHes account_status to active and updates only that user', async () => {
      const pending = apiUserFixtureAsAppUser({ userId: 'u2', accountStatus: 'pending' });
      const other = apiUserFixtureAsAppUser({ userId: 'u3', accountStatus: 'pending' });
      useAuthStore.setState({ token: 'tok', users: [pending, other] });
      mockUpdateUser.mockResolvedValue(buildApiUser({ id: 'u2', account_status: 'active' }));

      await useAuthStore.getState().approveUser('u2');

      expect(mockUpdateUser).toHaveBeenCalledWith('tok', 'u2', { account_status: 'active' });
      const state = useAuthStore.getState();
      expect(state.users.find((u) => u.userId === 'u2')?.accountStatus).toBe('active');
      expect(state.users.find((u) => u.userId === 'u3')?.accountStatus).toBe('pending');
    });

    it('rejectUser PATCHes account_status to rejected', async () => {
      const pending = apiUserFixtureAsAppUser({ userId: 'u2', accountStatus: 'pending' });
      useAuthStore.setState({ token: 'tok', users: [pending] });
      mockUpdateUser.mockResolvedValue(buildApiUser({ id: 'u2', account_status: 'rejected' }));

      await useAuthStore.getState().rejectUser('u2');

      expect(mockUpdateUser).toHaveBeenCalledWith('tok', 'u2', { account_status: 'rejected' });
      expect(useAuthStore.getState().users[0].accountStatus).toBe('rejected');
    });
  });

  describe('suspendUser / reactivateUser', () => {
    it('does nothing without a token', async () => {
      await useAuthStore.getState().suspendUser('u2');
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('suspendUser PATCHes account_status to suspended and updates only that user', async () => {
      const active = apiUserFixtureAsAppUser({ userId: 'u2', accountStatus: 'active' });
      const other = apiUserFixtureAsAppUser({ userId: 'u3', accountStatus: 'active' });
      useAuthStore.setState({ token: 'tok', users: [active, other] });
      mockUpdateUser.mockResolvedValue(buildApiUser({ id: 'u2', account_status: 'suspended' }));

      await useAuthStore.getState().suspendUser('u2');

      expect(mockUpdateUser).toHaveBeenCalledWith('tok', 'u2', { account_status: 'suspended' });
      const state = useAuthStore.getState();
      expect(state.users.find((u) => u.userId === 'u2')?.accountStatus).toBe('suspended');
      expect(state.users.find((u) => u.userId === 'u3')?.accountStatus).toBe('active');
    });

    it('reactivateUser PATCHes account_status back to active', async () => {
      const suspended = apiUserFixtureAsAppUser({ userId: 'u2', accountStatus: 'suspended' });
      useAuthStore.setState({ token: 'tok', users: [suspended] });
      mockUpdateUser.mockResolvedValue(buildApiUser({ id: 'u2', account_status: 'active' }));

      await useAuthStore.getState().reactivateUser('u2');

      expect(mockUpdateUser).toHaveBeenCalledWith('tok', 'u2', { account_status: 'active' });
      expect(useAuthStore.getState().users[0].accountStatus).toBe('active');
    });
  });

  describe('refreshUsers', () => {
    it('does nothing without a token', async () => {
      await useAuthStore.getState().refreshUsers();
      expect(mockListUsers).not.toHaveBeenCalled();
    });

    it('replaces the roster with the mapped API response', async () => {
      useAuthStore.setState({ token: 'tok' });
      mockListUsers.mockResolvedValue([buildApiUser({ id: 'u1' }), buildApiUser({ id: 'u2' })]);

      await useAuthStore.getState().refreshUsers();

      expect(useAuthStore.getState().users.map((u) => u.userId)).toEqual(['u1', 'u2']);
    });
  });

  describe('hydrateSession', () => {
    it('marks hydrated without touching the network when there is no stored token', async () => {
      mockGetToken.mockResolvedValue(null);

      await useAuthStore.getState().hydrateSession();

      expect(mockGetCurrentUser).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isHydrated).toBe(true);
      expect(state.token).toBeNull();
    });

    it('restores the session when the stored token is still valid', async () => {
      mockGetToken.mockResolvedValue('tok-saved');
      mockGetCurrentUser.mockResolvedValue(buildApiUser());
      mockListUsers.mockResolvedValue([buildApiUser()]);

      await useAuthStore.getState().hydrateSession();

      const state = useAuthStore.getState();
      expect(state.token).toBe('tok-saved');
      expect(state.currentUser?.userId).toBe('u1');
      expect(state.users).toHaveLength(1);
      expect(state.isHydrated).toBe(true);
      expect(mockClearToken).not.toHaveBeenCalled();
    });

    it('clears the stored token when it has expired/is invalid', async () => {
      mockGetToken.mockResolvedValue('tok-stale');
      mockGetCurrentUser.mockRejectedValue(new ApiError(401, 'Token expired'));

      await useAuthStore.getState().hydrateSession();

      expect(mockClearToken).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.currentUser).toBeNull();
      expect(state.isHydrated).toBe(true);
    });
  });
});

function apiUserFixtureAsAppUser(overrides: Partial<Resident> = {}): Resident {
  return {
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
    ...overrides,
  };
}
