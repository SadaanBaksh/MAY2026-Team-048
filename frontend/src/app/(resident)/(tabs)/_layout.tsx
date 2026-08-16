import { Ionicons } from '@expo/vector-icons';
import { Slot, Tabs } from 'expo-router';

import { FontFamily } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme } from '@/hooks/useTheme';

export default function ResidentTabsLayout() {
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();

  // On desktop, the parent (resident)/_layout.tsx renders the persistent sidebar;
  // this layout just needs to hand off to whichever tab screen is active.
  if (isDesktop) {
    return <Slot />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.teal,
        tabBarInactiveTintColor: Colors.inkTertiary,
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 2 },
        tabBarStyle: {
          height: 72,
          paddingTop: 7,
          paddingBottom: 7,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'Complaints',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={25}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="public"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={25}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
