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
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { authClient } from "@/lib/auth-client";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

function ScanningOverlay() {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // useNativeDriver: false required for layout properties like top/height percent
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

function SuccessToast({ onDone }: { onDone: () => void }) {
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
            <Text style={styles.toastSubtitle}>Your image is now protected.</Text>
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("Sorry, we need camera roll permissions to make this work!");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      if (Platform.OS === "ios") Haptics.selectionAsync();
      setSelectedImage(result.assets[0].uri);
      setShowSuccess(false); // Reset success state on new image
    }
  };

  const handleCloak = async () => {
    if (!selectedImage) return;

    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsScanning(true);

    // Simulate network request/processing
    setTimeout(() => {
      setIsScanning(false);
      setShowSuccess(true);
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 3000);
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
                source={{ uri: selectedImage }}
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
              <Text style={styles.primaryButtonText}>Cloaking Image...</Text>
            ) : showSuccess ? (
              <Text style={styles.primaryButtonText}>Protected</Text>
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
                  <Ionicons name="medical-outline" size={20} color="white" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.primaryButtonText}>Cloak Image</Text>
              </>
            )}
          </Pressable>

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
          <SuccessToast onDone={() => setShowSuccess(false)} />
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
    backdropFilter: "blur(10px)",
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
  secondaryButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#FF3B30",
    fontSize: 17,
  },

  // Scanning Styles
  scanLine: {
    height: 2,
    width: "100%",
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  // Toast Styles
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
    paddingRight: 20, // Extra padding for button
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
    backgroundColor: '#34C759', // Success green
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
