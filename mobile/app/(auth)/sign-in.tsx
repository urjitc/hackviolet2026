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
  ScrollView,
} from "react-native";
import { authClient } from "@/lib/auth-client";
import { Link } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFonts, Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Caveat_400Regular,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Polaroid-style card */}
          <View style={styles.polaroidCard}>
            {/* Header area (photo area) */}
            <View style={styles.headerArea}>
              <Text style={styles.title}>Cloaked</Text>
              <Text style={styles.subtitle}>welcome back</Text>
            </View>

            {/* Form area (caption area) */}
            <View style={styles.formArea}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>email</Text>
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(107,90,72,0.4)"
                  value={email}
                  onChangeText={setEmail}
                  inputMode="email"
                  autoCapitalize="none"
                  style={styles.input}
                  keyboardAppearance="light"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>password</Text>
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor="rgba(107,90,72,0.4)"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  secureTextEntry
                  keyboardAppearance="light"
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
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>sign in</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>new here? </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <Pressable>
                    <Text style={styles.linkText}>create account</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  polaroidCard: {
    backgroundColor: "#E8DCC8",
    borderRadius: 2,
    shadowColor: "#6B5A48",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
    overflow: "hidden",
  },
  headerArea: {
    backgroundColor: "#FFFFFF",
    padding: 28,
    paddingTop: 32,
    paddingHorizontal: 44,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(107,90,72,0.1)",
  },
  title: {
    fontSize: 40,
    color: "#6B5A48",
    fontFamily: "Caveat_700Bold",
    marginBottom: 4,
    marginTop: 10,
    paddingRight: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 22,
    color: "rgba(107,90,72,0.6)",
    fontFamily: "Caveat_400Regular",
  },
  formArea: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 20,
    color: "#6B5A48",
    fontFamily: "Caveat_600SemiBold",
  },
  input: {
    height: 50,
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "rgba(107,90,72,0.2)",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#6B5A48",
  },
  button: {
    height: 50,
    backgroundColor: "#C17A5C",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#C17A5C",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 22,
    fontFamily: "Caveat_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  footerText: {
    color: "rgba(107,90,72,0.7)",
    fontSize: 18,
    fontFamily: "Caveat_400Regular",
  },
  linkText: {
    color: "#C17A5C",
    fontSize: 18,
    fontFamily: "Caveat_600SemiBold",
    textDecorationLine: "underline",
  },
});
