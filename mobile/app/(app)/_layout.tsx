import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerBlurEffect: "systemThinMaterial",
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Cloak" }} />
    </Stack>
  );
}
