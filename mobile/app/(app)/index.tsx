import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";

import { SymbolView } from "expo-symbols";
import { authClient } from "@/lib/auth-client";
import { Ionicons } from "@expo/vector-icons";

import {
  uploadImageToStorage,
  createImagePair,
  updateImagePairStatus,
} from "@/lib/supabase";
import { useFonts, Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";
if (__DEV__ && !process.env.EXPO_PUBLIC_BACKEND_URL) {
  console.warn("EXPO_PUBLIC_BACKEND_URL not configured - localhost won't work on physical devices");
}

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
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [cloakedImage, setCloakedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [metadata, setMetadata] = useState<CloakResult["metadata"] | null>(null);

  const [fontsLoaded] = useFonts({
    Caveat_400Regular,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

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
      // Use URLSearchParams for application/x-www-form-urlencoded format
      const formBody = new URLSearchParams();
      formBody.append("image", selectedImageBase64);
      formBody.append("strength", "medium");

      const response = await fetch(`${BACKEND_URL}/cloak/base64`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
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
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library permissions to save the image.");
        return;
      }

      const base64Code = cloakedImage.split("base64,")[1];
      const filename = FileSystem.documentDirectory + `protected_${Date.now()}.png`;

      await FileSystem.writeAsStringAsync(filename, base64Code, {
        encoding: 'base64',
      });

      await MediaLibrary.saveToLibraryAsync(filename);

      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved!", "Image saved to your photos.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save image");
    }
  };



  return (
    <View style={{ flex: 1, backgroundColor: "#F9F7F3" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <View
          style={[
            styles.polaroidFrame,
            {
              transform: [{ rotate: '-3deg' }]
            }
          ]}
        >
          <Pressable
            onPress={pickImage}
            disabled={isScanning}
            style={({ pressed }) => [
              styles.photoArea,
              {
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }]
              }
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
                {isScanning && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="#C17A5C" />
                  </View>
                )}
                {!isScanning && (
                  <View style={styles.changeOverlay}>
                    <Text style={styles.changeText}>Change Photo</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.viewfinderContainer}>
                  <View style={styles.viewfinder}>
                    <View style={styles.cornerBrackets}>
                      <View style={[styles.bracket, styles.bracketTopLeft]} />
                      <View style={[styles.bracket, styles.bracketTopRight]} />
                      <View style={[styles.bracket, styles.bracketBottomLeft]} />
                      <View style={[styles.bracket, styles.bracketBottomRight]} />
                    </View>
                    {Platform.OS === "ios" ? (
                      <SymbolView
                        name="camera"
                        size={32}
                        tintColor="#9B8A76"
                      />
                    ) : (
                      <Ionicons name="camera-outline" size={32} color="#9B8A76" />
                    )}
                  </View>
                </View>
                <Text style={styles.uploadAction}>Click or drag</Text>
              </View>
            )}
          </Pressable>

          {/* Caption area - inside polaroid frame */}
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>ready to protect</Text>
          </View>
        </View>

        {/* File size hint - below polaroid */}
        <Text style={styles.fileHint}>PNG, JPEG, or WEBP up to 10MB</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={handleCloak}
            disabled={!selectedImage || isScanning}
            style={({ pressed }) => [
              styles.primaryButton,
              (!selectedImage || isScanning) && styles.disabledButton,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Cloaking Image...</Text>
              </>

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


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    gap: 24,
    backgroundColor: "#F9F7F3",
  },
  polaroidFrame: {
    width: "100%",
    backgroundColor: "#E8DCC8",
    padding: 16,
    paddingBottom: 56,
    borderRadius: 2,
    shadowColor: "#6B5A48",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  photoArea: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232,220,200,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  changeOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    alignItems: "center",
    backgroundColor: "rgba(107,90,72,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
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
    gap: 16,
  },
  viewfinderContainer: {
    marginBottom: 8,
  },
  viewfinder: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cornerBrackets: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  bracket: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#9B8A76",
    borderWidth: 2,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  uploadAction: {
    fontSize: 14,
    color: "#9B8A76",
    letterSpacing: 0.3,
  },
  captionContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  captionText: {
    fontSize: 18,
    color: "#6B5A48",
    fontFamily: "Caveat_400Regular",
  },
  fileHint: {
    fontSize: 16,
    color: "#6B5A48",
    opacity: 0.6,
    fontFamily: "Caveat_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  actions: {
    gap: 16,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: "#C17A5C",
    height: 54,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6B5A48",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: "#B8A898",
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#8B7255",
    height: 50,
    borderRadius: 12,
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
    color: "#A0715E",
    fontSize: 17,
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
    backgroundColor: '#8B7255',
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
