import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

// Overriding only the deep Platform module (rather than requireActual-ing the whole
// 'react-native' package) avoids eagerly loading native-only internals (e.g. the DevMenu
// turbo module) that aren't wired up outside of the jest-expo/react-native preset's own
// mocked require path.
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'web', select: (spec: Record<string, unknown>) => spec.web ?? spec.default },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const TOKEN_KEY = 'simplifix-auth-token';

describe('tokenStorage on web', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('reads the token from AsyncStorage', async () => {
    await AsyncStorage.setItem(TOKEN_KEY, 'web-token');
    await expect(getToken()).resolves.toBe('web-token');
  });

  it('returns null when AsyncStorage has no token', async () => {
    await expect(getToken()).resolves.toBeNull();
  });

  it('writes the token to AsyncStorage', async () => {
    await setToken('web-abc');
    await expect(AsyncStorage.getItem(TOKEN_KEY)).resolves.toBe('web-abc');
  });

  it('clears the token from AsyncStorage', async () => {
    await AsyncStorage.setItem(TOKEN_KEY, 'web-abc');
    await clearToken();
    await expect(AsyncStorage.getItem(TOKEN_KEY)).resolves.toBeNull();
  });

  it('never touches SecureStore', async () => {
    await getToken();
    await setToken('x');
    await clearToken();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
