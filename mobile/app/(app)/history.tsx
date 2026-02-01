import { useState, useRef, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Ellipse } from "react-native-svg";
import { authClient } from "@/lib/auth-client";
import {
  getUserImagePairs,
  deleteImagePair,
  deleteImageFromStorage,
  getPathFromUrl,
  type ImagePair,
} from "@/lib/supabase";
import { useFonts, Caveat_400Regular } from '@expo-google-fonts/caveat';

// Clothespin component
function Clothespin() {
  return (
    <Svg width="28" height="32" viewBox="0 0 28 32" style={{ marginBottom: -24 }}>
      {/* Left prong with wood grain */}
      <Path
        d="M7 0 L7 12 Q7 16 9 18 L9 32"
        stroke="#C4A882"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M7 0 L7 12 Q7 16 9 18 L9 32"
        stroke="#8B7355"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Right prong with wood grain */}
      <Path
        d="M21 0 L21 12 Q21 16 19 18 L19 32"
        stroke="#C4A882"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M21 0 L21 12 Q21 16 19 18 L19 32"
        stroke="#8B7355"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Metal spring */}
      <Ellipse
        cx="14"
        cy="13"
        rx="5"
        ry="4"
        fill="#9CA3AF"
        stroke="#6B7280"
        strokeWidth="1.5"
      />
      {/* Spring coil detail */}
      <Path
        d="M10 13 Q14 10 18 13 Q14 16 10 13"
        stroke="#4B5563"
        strokeWidth="0.5"
        fill="none"
      />
    </Svg>
  );
}

// Random tilt for organic look
function getRandomTilt(index: number): number {
  const tilts = [-3, -1.5, 2.5, -2, 1, 3, -0.5, -2.5, 2, -1];
  return tilts[index % tilts.length];
}


export default function HistoryScreen() {
  const { data: session } = authClient.useSession();
  const [images, setImages] = useState<ImagePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Caveat_400Regular,
  });

  const fetchImages = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await getUserImagePairs(session.user.id);
      setImages(data);
    } catch (error) {
      console.error("Failed to fetch images:", error);
      Alert.alert("Error", "Failed to load images");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchImages();
    }, [fetchImages])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchImages();
  };

  const handleSave = async (url: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library permissions to save the image.");
        return;
      }

      const filename = FileSystem.documentDirectory + `protected_${Date.now()}.png`;
      const { uri } = await FileSystem.downloadAsync(url, filename);

      await MediaLibrary.saveToLibraryAsync(uri);

      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved", "Image saved to photos");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save image");
    }
  };

  const handleDelete = async (item: ImagePair) => {
    Alert.alert(
      "Delete Image",
      "Are you sure you want to delete this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.id);
            try {
              // Delete from storage
              const originalPath = getPathFromUrl(item.original_url);
              if (originalPath) {
                await deleteImageFromStorage(originalPath);
              }

              if (item.protected_url) {
                const protectedPath = getPathFromUrl(item.protected_url);
                if (protectedPath) {
                  await deleteImageFromStorage(protectedPath);
                }
              }

              // Delete from database
              const success = await deleteImagePair(item.id);
              if (success) {
                setImages((prev) => prev.filter((img) => img.id !== item.id));
                if (Platform.OS === "ios") {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } else {
                throw new Error("Failed to delete");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete image");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderItem = ({ item, index }: { item: ImagePair; index: number }) => {
    const tilt = getRandomTilt(index);
    const isCompleted = item.status === "completed";

    return (
      <View style={styles.polaroidContainer}>
        {/* Clothespin */}
        <View style={styles.clothespinContainer}>
          <Clothespin />
        </View>

        {/* Polaroid Card */}
        <Pressable
          style={[
            styles.polaroidCard,
            { transform: [{ rotate: `${tilt}deg` }] }
          ]}
        >
          {/* Photo Area */}
          <View style={styles.photoArea}>
            <Image
              source={{ uri: item.protected_url || item.original_url }}
              style={styles.polaroidImage}
              contentFit="cover"
              transition={200}
            />

            {/* Status indicator dot */}
            {!isCompleted && (
              <View style={[
                styles.statusDot,
                item.status === "processing" && styles.statusProcessing,
                item.status === "failed" && styles.statusFailed,
                item.status === "pending" && styles.statusPending,
              ]} />
            )}

            {/* Action buttons overlay */}
            <View style={styles.actionOverlay}>
              {item.protected_url && (
                <Pressable
                  onPress={() => handleSave(item.protected_url!)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="download-outline" size={20} color="#6B5A48" />
                </Pressable>
              )}

              <Pressable
                onPress={() => handleDelete(item)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color="#C17A5C" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#C17A5C" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Caption with date */}
          <View style={styles.polaroidCaption}>
            <Text style={styles.captionText}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C17A5C" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Not Signed In</Text>
        <Text style={styles.emptyTitle}>
          Sign in to view your image history
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {images.length === 0 ? (
        <View style={styles.emptyState}>
          {/* Empty clothespins */}
          <View style={styles.emptyClothespins}>
            <Clothespin />
            <Clothespin />
            <Clothespin />
          </View>
          <Text style={styles.emptyTitle}>your images are protected here</Text>
        </View>
      ) : (
        <FlatList
          data={images}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F7F3",
  },
  grid: {
    padding: 16,
    paddingTop: 32,
    paddingBottom: 100,
  },
  row: {
    gap: 16,
    marginBottom: 24,
  },
  polaroidContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  clothespinContainer: {
    alignItems: "center",
    zIndex: 10,
  },
  polaroidCard: {
    backgroundColor: "#E8DCC8",
    padding: 12,
    paddingBottom: 40,
    borderRadius: 2,
    shadowColor: "#6B5A48",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  photoArea: {
    width: 140,
    height: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
    overflow: "hidden",
    position: "relative",
  },
  polaroidImage: {
    width: "100%",
    height: "100%",
  },
  statusDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF9500",
  },
  statusProcessing: {
    backgroundColor: "#007AFF",
  },
  statusFailed: {
    backgroundColor: "#FF3B30",
  },
  statusPending: {
    backgroundColor: "#FF9500",
  },
  actionOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(107,90,72,0.9)",
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
    opacity: 0.95,
  },
  actionButton: {
    backgroundColor: "#FAF8F5",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  polaroidCaption: {
    marginTop: 8,
    alignItems: "center",
  },
  captionText: {
    fontSize: 16,
    color: "#6B5A48",
    opacity: 0.8,
    fontFamily: "Caveat_400Regular",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 32,
  },
  emptyClothespins: {
    flexDirection: "row",
    gap: 32,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 24,
    color: "#6B5A48",
    opacity: 0.6,
    fontFamily: "Caveat_400Regular",
    textAlign: "center",
  },
});
