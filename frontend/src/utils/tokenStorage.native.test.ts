/// <reference types="jest" />

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const TOKEN_KEY = 'simplifix-auth-token';

describe('tokenStorage on native platforms', () => {
  // jest-expo's default test platform is iOS; confirm that assumption holds so a preset
  // upgrade that changes it doesn't silently turn this into a no-op test of the web branch.
  it('runs against a non-web Platform.OS', () => {
    expect(Platform.OS).not.toBe('web');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the token from SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('native-token');
    await expect(getToken()).resolves.toBe('native-token');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
  });

  it('returns null when SecureStore has no token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(getToken()).resolves.toBeNull();
  });

  it('writes the token via SecureStore', async () => {
    await setToken('abc123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'abc123');
  });

  it('clears the token via SecureStore', async () => {
    await clearToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
  });
});
