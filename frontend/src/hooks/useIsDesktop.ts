import { useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 900;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
