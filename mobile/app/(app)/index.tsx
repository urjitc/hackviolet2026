import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { SymbolView } from "expo-symbols";
import { authClient } from "@/lib/auth-client";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  uploadImageToStorage,
  createImagePair,
  updateImagePairStatus,
} from "@/lib/supabase";

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

function ScanningOverlay() {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const top = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,122,255,0.1)' }]} />
      <Animated.View style={[styles.scanLine, { top }]}>
        <LinearGradient
          colors={["rgba(50,200,255,0)", "rgba(50,200,255,0.8)", "rgba(50,200,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

function SuccessToast({ onDone, metadata }: { onDone: () => void; metadata?: CloakResult["metadata"] }) {
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 15,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.toast}>
        <View style={styles.toastContent}>
          <View style={styles.checkCircle}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="checkmark" size={20} tintColor="white" />
            ) : (
              <Ionicons name="checkmark" size={24} color="white" />
            )}
          </View>
          <View style={styles.toastTextContainer}>
            <Text style={styles.toastTitle}>Cloaking Complete</Text>
            <Text style={styles.toastSubtitle}>
              {metadata ? `${metadata.faces_detected} face(s) protected` : "Your image is now protected."}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.doneButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { data: session } = authClient.useSession();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [cloakedImage, setCloakedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [strength, setStrength] = useState<CloakingStrength>("medium");
  const [metadata, setMetadata] = useState<CloakResult["metadata"] | null>(null);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to select images.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      if (Platform.OS === "ios") Haptics.selectionAsync();
      setSelectedImage(result.assets[0].uri);
      setSelectedImageBase64(result.assets[0].base64 || null);
      setCloakedImage(null);
      setMetadata(null);
      setShowSuccess(false);
    }
  };

  const handleCloak = async () => {
    if (!selectedImage || !selectedImageBase64) return;

    const userId = session?.user?.id;

    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsScanning(true);

    let imagePairId: string | null = null;

    try {
      // Step 1: Upload original image to Supabase Storage (if user is logged in)
      if (userId) {
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const originalPath = `originals/${userId}/${fileId}.png`;

        const uploadResult = await uploadImageToStorage(
          selectedImageBase64,
          originalPath,
          "image/png"
        );

        if ("error" in uploadResult) {
          console.warn("Failed to upload original:", uploadResult.error);
        } else {
          // Step 2: Create database record
          const imagePair = await createImagePair(userId, uploadResult.url);
          if (imagePair) {
            imagePairId = imagePair.id;
            await updateImagePairStatus(imagePairId, "processing");
          }
        }
      }

      // Step 3: Call backend to cloak the image
      const formData = new FormData();
      formData.append("image", selectedImageBase64);
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

      // Step 4: Upload cloaked image to Supabase Storage (if user is logged in)
      if (userId && imagePairId) {
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const protectedPath = `protected/${userId}/${fileId}.png`;

        const protectedUpload = await uploadImageToStorage(
          data.cloaked_image,
          protectedPath,
          "image/png"
        );

        if ("url" in protectedUpload) {
          // Step 5: Update database record with protected URL
          await updateImagePairStatus(imagePairId, "completed", protectedUpload.url);
        } else {
          await updateImagePairStatus(imagePairId, "failed");
        }
      }

      setCloakedImage(`data:image/png;base64,${data.cloaked_image}`);
      setMetadata(data.metadata);
      setShowSuccess(true);
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Update status to failed if we have a record
      if (imagePairId) {
        await updateImagePairStatus(imagePairId, "failed");
      }

      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to process image"
      );
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsScanning(false);
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

      await Sharing.shareAsync(cloakedImage, {
        mimeType: "image/png",
        dialogTitle: "Save Protected Image",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share image");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.subtitle}>
            Protect your identity from AI manipulation. Upload a photo to apply
            invisible cloaking layers.
          </Text>
        </View>

        {/* Strength Selector */}
        <View style={styles.strengthContainer}>
          <Text style={styles.strengthLabel}>Protection Strength</Text>
          <View style={styles.strengthButtons}>
            {(["light", "medium", "strong"] as CloakingStrength[]).map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [
                  styles.strengthButton,
                  strength === s && styles.strengthButtonActive,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  setStrength(s);
                  if (Platform.OS === "ios") Haptics.selectionAsync();
                }}
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

        <Pressable
          onPress={pickImage}
          disabled={isScanning}
          style={({ pressed }) => [
            styles.uploadCard,
            { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            !selectedImage && styles.uploadCardEmpty,
          ]}
        >
          {selectedImage ? (
            <>
              <Image
                source={{ uri: cloakedImage || selectedImage }}
                style={styles.previewImage}
                contentFit="cover"
                transition={300}
              />
              {isScanning && <ScanningOverlay />}
              {!isScanning && !showSuccess && (
                <View style={styles.changeOverlay}>
                  <Text style={styles.changeText}>Change Photo</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.iconContainer}>
                {Platform.OS === "ios" ? (
                  <SymbolView
                    name="photo.badge.plus"
                    size={40}
                    tintColor="#007AFF"
                    animationSpec={{
                      effect: {
                        type: "bounce",
                      },
                    }}
                  />
                ) : (
                  <Ionicons name="image-outline" size={40} color="#007AFF" />
                )}
              </View>
              <Text style={styles.uploadTitle}>Select a Photo</Text>
              <Text style={styles.uploadSubtitle}>
                Tap to choose from library
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={handleCloak}
            disabled={!selectedImage || isScanning || showSuccess}
            style={({ pressed }) => [
              styles.primaryButton,
              (!selectedImage || isScanning || showSuccess) && styles.disabledButton,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Cloaking Image...</Text>
              </>
            ) : showSuccess ? (
              <Text style={styles.primaryButtonText}>Protected ✓</Text>
            ) : (
              <>
                {Platform.OS === "ios" ? (
                  <SymbolView
                    name="wand.and.stars"
                    size={20}
                    tintColor="white"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Ionicons name="shield-checkmark-outline" size={20} color="white" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.primaryButtonText}>Cloak Image</Text>
              </>
            )}
          </Pressable>

          {cloakedImage && (
            <Pressable
              onPress={saveImage}
              style={({ pressed }) => [
                styles.saveButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="download-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Save Protected Image</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => authClient.signOut()}
            style={({ pressed }) => [
              styles.secondaryButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {showSuccess && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <SuccessToast onDone={() => setShowSuccess(false)} metadata={metadata || undefined} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 24,
  },
  headerContainer: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: "#666",
  },
  strengthContainer: {
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  strengthButtons: {
    flexDirection: "row",
    gap: 10,
  },
  strengthButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  strengthButtonActive: {
    backgroundColor: "#007AFF",
  },
  strengthButtonText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "500",
  },
  strengthButtonTextActive: {
    color: "#FFFFFF",
  },
  uploadCard: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  uploadCardEmpty: {
    borderWidth: 2,
    borderColor: "#E5E5EA",
    borderStyle: "dashed",
    backgroundColor: "#FAFAFA",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  changeOverlay: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E1F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
  },
  uploadSubtitle: {
    fontSize: 15,
    color: "#8E8E93",
  },
  actions: {
    gap: 16,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: "#AAB8C2",
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#34C759",
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#FF3B30",
    fontSize: 17,
  },
  scanLine: {
    height: 2,
    width: "100%",
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  toast: {
    width: '100%',
    padding: 16,
    paddingRight: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  toastSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  doneButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  }
});
