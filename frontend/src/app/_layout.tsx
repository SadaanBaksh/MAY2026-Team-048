import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/archivo';
import { Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { Colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Manrope_700Bold,
  });
  const isSessionHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateSession = useAuthStore((s) => s.hydrateSession);
  const token = useAuthStore((s) => s.token);
  const refreshTickets = useTicketStore((s) => s.refreshTickets);
  const refreshPublicServices = usePublicServiceStore((s) => s.refreshServices);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (token) refreshTickets(token);
    if (token) refreshPublicServices(token);
  }, [token, refreshTickets, refreshPublicServices]);

  useEffect(() => {
    if (fontsLoaded && isSessionHydrated) SplashScreen.hideAsync();
  }, [fontsLoaded, isSessionHydrated]);

  // React Native Web renders TextInput as input/textarea DOM elements. Reset
  // the browser focus decoration globally so it cannot add a black rectangle
  // on top of the app's own field borders and focus states.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.id = 'simplifix-form-control-reset';
    style.textContent = `
      input,
      textarea,
      select {
        box-sizing: border-box;
      }

      input:focus,
      input:focus-visible,
      textarea:focus,
      textarea:focus-visible,
      select:focus,
      select:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }

      input::-moz-focus-inner,
      textarea::-moz-focus-inner {
        border: 0;
      }
    `;
    document.head.appendChild(style);

    return () => style.remove();
  }, []);

  if (!fontsLoaded || !isSessionHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: Colors.surfaceMuted }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.surfaceMuted },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(resident)" />
          <Stack.Screen name="(employee)" />
          <Stack.Screen name="(maintenance)" />
          <Stack.Screen name="(manager)" />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
