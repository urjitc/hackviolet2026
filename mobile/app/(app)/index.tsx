import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

import { authClient } from "@/lib/auth-client";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

type CloakingStrength = "light" | "medium" | "strong";

interface CloakResult {
  id: string;
  cloaked_image: string;
  metadata: {
    strength: string;
    attack_type: string;
    faces_detected: number;
  };
}

export default function HomeScreen() {
  const { data: session } = authClient.useSession();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cloakedImage, setCloakedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [strength, setStrength] = useState<CloakingStrength>("medium");
  const [metadata, setMetadata] = useState<CloakResult["metadata"] | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera roll permissions to select images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setCloakedImage(null);
      setMetadata(null);

      if (result.assets[0].base64) {
        await processImage(result.assets[0].base64);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera permissions to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setCloakedImage(null);
      setMetadata(null);

      if (result.assets[0].base64) {
        await processImage(result.assets[0].base64);
      }
    }
  };

  const processImage = async (base64Image: string) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("image", base64Image);
      formData.append("strength", strength);

      const response = await fetch(`${BACKEND_URL}/cloak/base64`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Cloaking failed");
      }

      const data: CloakResult = await response.json();
      setCloakedImage(`data:image/png;base64,${data.cloaked_image}`);
      setMetadata(data.metadata);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to process image"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const saveImage = async () => {
    if (!cloakedImage) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device");
        return;
      }

      // Share the base64 image as a data URI
      await Sharing.shareAsync(cloakedImage, {
        mimeType: "image/png",
        dialogTitle: "Save Protected Image",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share image");
    }
  };

  const handleSignOut = () => {
    authClient.signOut();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DeepGuard</Text>
        <Pressable onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={styles.welcome}>Welcome, {session?.user?.name || "User"}</Text>
      <Text style={styles.subtitle}>
        Protect your photos from deepfake manipulation
      </Text>

      {/* Strength Selector */}
      <View style={styles.strengthContainer}>
        <Text style={styles.strengthLabel}>Protection Strength:</Text>
        <View style={styles.strengthButtons}>
          {(["light", "medium", "strong"] as CloakingStrength[]).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.strengthButton,
                strength === s && styles.strengthButtonActive,
              ]}
              onPress={() => setStrength(s)}
            >
              <Text
                style={[
                  styles.strengthButtonText,
                  strength === s && styles.strengthButtonTextActive,
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Upload Buttons */}
      <View style={styles.uploadButtons}>
        <Pressable style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>Choose Photo</Text>
        </Pressable>
        <Pressable style={styles.uploadButton} onPress={takePhoto}>
          <Text style={styles.uploadButtonText}>Take Photo</Text>
        </Pressable>
      </View>

      {/* Processing Indicator */}
      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.processingText}>Applying protection...</Text>
        </View>
      )}

      {/* Results */}
      {selectedImage && !isProcessing && (
        <View style={styles.resultsContainer}>
          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Original</Text>
              <Image source={{ uri: selectedImage }} style={styles.image} />
            </View>
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Protected</Text>
              {cloakedImage ? (
                <Image source={{ uri: cloakedImage }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Text style={styles.placeholderText}>Processing...</Text>
                </View>
              )}
            </View>
          </View>

          {metadata && (
            <View style={styles.metadataContainer}>
              <Text style={styles.metadataTitle}>Protection Details</Text>
              <Text style={styles.metadataText}>
                Strength: {metadata.strength}
              </Text>
              <Text style={styles.metadataText}>
                Attack: {metadata.attack_type}
              </Text>
              <Text style={styles.metadataText}>
                Faces detected: {metadata.faces_detected}
              </Text>
            </View>
          )}

          {cloakedImage && (
            <Pressable style={styles.saveButton} onPress={saveImage}>
              <Text style={styles.saveButtonText}>Save Protected Image</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          1. Select or take a photo{"\n"}
          2. Our AI adds invisible protection{"\n"}
          3. Save the protected version{"\n"}
          4. Your photo is now resistant to deepfakes
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F0F",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  signOutButton: {
    padding: 8,
  },
  signOutText: {
    color: "#8B5CF6",
    fontSize: 14,
  },
  welcome: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 24,
  },
  strengthContainer: {
    marginBottom: 20,
  },
  strengthLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 8,
  },
  strengthButtons: {
    flexDirection: "row",
    gap: 8,
  },
  strengthButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
  },
  strengthButtonActive: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  strengthButtonText: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "500",
  },
  strengthButtonTextActive: {
    color: "#FFFFFF",
  },
  uploadButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: "#8B5CF6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  processingContainer: {
    alignItems: "center",
    padding: 40,
  },
  processingText: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 16,
  },
  resultsContainer: {
    marginBottom: 24,
  },
  imageRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  imageContainer: {
    flex: 1,
  },
  imageLabel: {
    color: "#888888",
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#888888",
    fontSize: 14,
  },
  metadataContainer: {
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  metadataTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  metadataText: {
    color: "#888888",
    fontSize: 14,
    marginBottom: 4,
  },
  saveButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoContainer: {
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    color: "#888888",
    fontSize: 14,
    lineHeight: 22,
  },
});
