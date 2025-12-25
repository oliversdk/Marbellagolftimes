import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { golfApi, CourseWithSlots } from '../api/client';

const MARBELLA_COORDS = { lat: 36.5101, lng: -4.8826 };

const GOLF_IMAGES = [
  'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600',
  'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600',
  'https://images.unsplash.com/photo-1592919505780-303950717480?w=600',
  'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=600',
  'https://images.unsplash.com/photo-1600791029037-86de8f141faa?w=600',
];

const getImageUrl = (courseId: string): string => {
  const index = Math.abs(courseId.charCodeAt(0)) % GOLF_IMAGES.length;
  return GOLF_IMAGES[index];
};

export default function HomeScreen() {
  const [courses, setCourses] = useState<CourseWithSlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourses = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await golfApi.searchSlots({
        lat: MARBELLA_COORDS.lat,
        lng: MARBELLA_COORDS.lng,
        date: today,
        players: 2,
        holes: 18,
      });
      setCourses(data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses();
  };

  const formatPrice = (price: number) => {
    return `€${price}`;
  };

  const renderCourse = ({ item }: { item: CourseWithSlots }) => {
    const lowestPrice = item.slots.length > 0
      ? Math.min(...item.slots.map(s => s.greenFee))
      : null;

    return (
      <TouchableOpacity style={styles.courseCard}>
        <Image
          source={{ uri: getImageUrl(item.courseId) }}
          style={styles.courseImage}
        />
        <View style={styles.courseInfo}>
          <Text style={styles.courseName}>{item.courseName}</Text>
          <Text style={styles.courseLocation}>
            {item.course.city} • {item.distanceKm.toFixed(1)} km
          </Text>
          <View style={styles.priceRow}>
            {lowestPrice ? (
              <Text style={styles.price}>From {formatPrice(lowestPrice)}</Text>
            ) : (
              <Text style={styles.noSlots}>No tee times available</Text>
            )}
            <Text style={styles.slotsCount}>{item.slots.length} times</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#166534" />
        <Text style={styles.loadingText}>Finding golf courses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marbella Golf Times</Text>
        <Text style={styles.headerSubtitle}>Book tee times on Costa del Sol</Text>
      </View>
      
      <FlatList
        data={courses}
        renderItem={renderCourse}
        keyExtractor={(item) => item.courseId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No courses found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#166534',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#bbf7d0',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  list: {
    padding: 16,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  courseImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#e2e8f0',
  },
  courseInfo: {
    padding: 16,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  courseLocation: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#166534',
  },
  noSlots: {
    fontSize: 14,
    color: '#94a3b8',
  },
  slotsCount: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
  },
});
