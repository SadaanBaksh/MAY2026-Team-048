import { useThemeStore } from '@/store/themeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light' });
  });

  it('defaults to light mode', () => {
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('toggleTheme flips light to dark and back again', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('dark');

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('setMode sets the mode directly, independent of the current value', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');

    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');

    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });
});
