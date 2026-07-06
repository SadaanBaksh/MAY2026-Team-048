import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: Colors.surfaceMuted }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surfaceMuted } }}>
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
