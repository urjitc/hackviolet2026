import { useState, useEffect, useCallback } from "react";
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
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "@/lib/auth-client";
import {
  getUserImagePairs,
  deleteImagePair,
  deleteImageFromStorage,
  getPathFromUrl,
  type ImagePair,
} from "@/lib/supabase";

export default function HistoryScreen() {
  const { data: session } = authClient.useSession();
  const [images, setImages] = useState<ImagePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchImages();
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

  const handleShare = async (url: string) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device");
        return;
      }

      await Sharing.shareAsync(url, {
        mimeType: "image/png",
        dialogTitle: "Share Protected Image",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share image");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#34C759";
      case "processing":
        return "#007AFF";
      case "failed":
        return "#FF3B30";
      default:
        return "#FF9500";
    }
  };

  const renderItem = ({ item }: { item: ImagePair }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.protected_url || item.original_url }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.cardFooter}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        <View style={styles.actions}>
          {item.protected_url && (
            <Pressable
              onPress={() => handleShare(item.protected_url!)}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="share-outline" size={18} color="#007AFF" />
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
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Not Signed In</Text>
        <Text style={styles.emptySubtitle}>
          Sign in to view your image history
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {images.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Images Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your protected images will appear here
          </Text>
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
    backgroundColor: "#F2F2F7",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  grid: {
    padding: 8,
    paddingBottom: 100,
  },
  row: {
    gap: 8,
  },
  card: {
    flex: 1,
    margin: 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  cardFooter: {
    padding: 12,
    gap: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
  },
});
