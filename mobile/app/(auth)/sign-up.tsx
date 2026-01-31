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
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    const signUpResponse = await authClient.signUp.email({
      email,
      password,
      name,
    });
    setIsLoading(false);

    if (signUpResponse.error) {
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", signUpResponse.error.message);
      return;
    }

    if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.container}>
      <Image
        source="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={1000}
      />
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              {Platform.OS === "ios" ? (
                <SymbolView name="person.badge.plus" size={40} tintColor="white" />
              ) : (
                <Ionicons name="person-add" size={40} color="white" />
              )}
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us to start protecting your digital identity</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="light" />
              <TextInput
                placeholder="Full Name"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={name}
                onChangeText={setName}
                style={styles.input}
                keyboardAppearance="dark"
              />
            </View>

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
              onPress={handleSignUp}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.button,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={["#007AFF", "#00C7BE"]} // Different gradient for signup
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
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
    shadowColor: "#00C7BE",
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
});
