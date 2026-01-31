import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "rgba(255,255,255,0.95)",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0.1,
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Cloak",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="shield" size={size} tintColor={color} />
            ) : (
              <Ionicons name="shield-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="photo.stack" size={size} tintColor={color} />
            ) : (
              <Ionicons name="images-outline" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
