import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';


type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
};


export default function HomeScreen() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);


  useFocusEffect(
    useCallback(() => {
      const loadPhotos = async () => {
        const savedPhotos =
          await AsyncStorage.getItem('photos');

        if (savedPhotos === null) {
          setPhotos([]);
          return;
        }

        const parsedPhotos: PhotoRecord[] =
          JSON.parse(savedPhotos);

        setPhotos(parsedPhotos);
      };

      loadPhotos();
    }, [])
  );


  const getPhotoLabel = (photo: PhotoRecord) => {
    if (photo.subject) {
      return photo.subject;
    }

    if (
      photo.period !== null &&
      photo.day !== ''
    ) {
      return `${photo.day}曜${photo.period}限`;
    }

    return '未分類';
  };


  const groupedPhotos =
    photos.reduce<Record<string, PhotoRecord[]>>(
      (groups, photo) => {
        const label = getPhotoLabel(photo);

        if (!groups[label]) {
          groups[label] = [];
        }

        groups[label].push(photo);

        return groups;
      },
      {}
    );


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        StudyPhoto
      </Text>

      <Text style={styles.subtitle}>
        講義写真を自動で整理
      </Text>


      <Pressable
        style={styles.mainButton}
        onPress={() => router.push('/camera')}
      >
        <Text style={styles.buttonText}>
          📷 写真を撮る
        </Text>
      </Pressable>


      <Pressable
        style={styles.mainButton}
        onPress={() => router.push('/library')}
      >
        <Text style={styles.buttonText}>
          🖼 写真ライブラリから選ぶ
        </Text>
      </Pressable>


      <Pressable
        style={styles.timetableButton}
        onPress={() => router.push('/timetable')}
      >
        <Text style={styles.buttonText}>
          🗓 時間割
        </Text>
      </Pressable>


      <Text style={styles.sectionTitle}>
        授業
      </Text>


      {Object.keys(groupedPhotos).length === 0 ? (
        <Text style={styles.emptyText}>
          まだ写真がありません
        </Text>
      ) : (
        <View style={styles.subjectList}>
          {Object.entries(groupedPhotos).map(
            ([subject, subjectPhotos]) => (
              <Pressable
                  key={subject}
                  style={styles.subjectCard}
                  onPress={() =>
                    router.push({
                      pathname: '/subject/[subject]',
                      params: { subject },
                    })
                  }
                >
                <View>
                  <Text style={styles.subjectName}>
                    {subject}
                  </Text>

                  <Text style={styles.subjectCount}>
                    {subjectPhotos.length}枚
                  </Text>
                </View>

                <Text style={styles.arrow}>
                  ›
                </Text>
              </Pressable>
            )
          )}
        </View>
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'black',
    marginTop: 40,
  },

  subtitle: {
    fontSize: 16,
    color: '#555',
    marginTop: 8,
    marginBottom: 32,
  },

  mainButton: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#333',
    marginBottom: 12,
  },

  timetableButton: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#333',
    marginBottom: 32,
  },

  buttonText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 16,
  },

  emptyText: {
    color: '#777',
    fontSize: 15,
  },

  subjectList: {
    gap: 12,
    paddingBottom: 40,
  },

  subjectCard: {
    backgroundColor: '#f2f2f2',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
  },

  subjectCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  arrow: {
    fontSize: 30,
    color: '#888',
  },
});