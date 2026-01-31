import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { authClient } from "@/lib/auth-client";
import { Link } from "expo-router";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    const signInResponse = await authClient.signIn.email({
      email,
      password,
    });
    setIsLoading(false);

    if (signInResponse.error) {
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", signInResponse.error.message);
      return;
    }

    if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.container}>
      <Image
        source="https://images.unsplash.com/photo-1614850523060-8da1d56ae167?q=80&w=2670&auto=format&fit=crop"
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={1000}
      />
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              {Platform.OS === "ios" ? (
                <SymbolView name="lock.shield" size={40} tintColor="white" />
              ) : (
                <Ionicons name="shield-checkmark" size={40} color="white" />
              )}
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue protecting your privacy</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="light" />
              <TextInput
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={email}
                onChangeText={setEmail}
                inputMode="email"
                autoCapitalize="none"
                style={styles.input}
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.inputContainer}>
              <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="light" />
              <TextInput
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
                keyboardAppearance="dark"
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.button,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={["#007AFF", "#5856D6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text style={styles.linkText}>Sign Up</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    padding: 24,
    gap: 32,
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    color: "white",
    fontSize: 16,
  },
  button: {
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  footerText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
  },
  linkText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
