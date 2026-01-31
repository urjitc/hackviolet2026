import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || "http://localhost:8081";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  disableDefaultFetchPlugins: true,
  plugins: [
    expoClient({
      scheme: "myapp",
      storagePrefix: "myapp",
      storage: SecureStore,
    }),
  ],
});
