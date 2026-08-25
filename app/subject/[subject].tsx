import { useEffect, useState } from 'react';

import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Image } from 'expo-image';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';


type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
};


type LectureGroup = {
  dateKey: string;
  dateLabel: string;
  photos: PhotoRecord[];
};


type PhotoRow = {
  id: string;
  photos: PhotoRecord[];
};


type LectureSection = LectureGroup & {
  title: string;
  data: PhotoRow[];
};


export default function SubjectScreen() {
  const params = useLocalSearchParams();

  const subject =
    typeof params.subject === 'string'
      ? params.subject
      : '';

  const [lectureGroups, setLectureGroups] =
    useState<LectureGroup[]>([]);

  const [status, setStatus] =
    useState('読み込み中...');


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


  const getDateKey = (photo: PhotoRecord) => {
    const date = new Date(photo.takenAt);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year}-${month}-${day}`;
  };


  const getDateLabel = (photo: PhotoRecord) => {
    const date = new Date(photo.takenAt);

    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${month}/${day}`;
  };


  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const savedPhotos =
          await AsyncStorage.getItem('photos');

        if (savedPhotos === null) {
          setLectureGroups([]);
          setStatus('写真がありません');
          return;
        }

        const allPhotos: PhotoRecord[] =
          JSON.parse(savedPhotos);


        const subjectPhotos =
          allPhotos.filter((photo) => {
            return getPhotoLabel(photo) === subject;
          });


        const grouped: Record<
          string,
          PhotoRecord[]
        > = {};

        subjectPhotos.forEach((photo) => {
          const dateKey = getDateKey(photo);

          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }

          grouped[dateKey].push(photo);
        });


        const groups: LectureGroup[] =
          Object.entries(grouped)
            .map(([dateKey, photos]) => {
              const sortedPhotos =
                [...photos].sort((a, b) => {
                  const dateA =
                    new Date(a.takenAt).getTime();

                  const dateB =
                    new Date(b.takenAt).getTime();

                  return dateA - dateB;
                });

              return {
                dateKey,
                dateLabel: getDateLabel(sortedPhotos[0]),
                photos: sortedPhotos,
              };
            })
            .sort((a, b) => {
              const dateA =
                new Date(
                  a.photos[0].takenAt
                ).getTime();

              const dateB =
                new Date(
                  b.photos[0].takenAt
                ).getTime();

              return dateA - dateB;
            });


        setLectureGroups(groups);

        setStatus(
          `${subjectPhotos.length}枚の写真`
        );
      } catch (error) {
        console.log(
          '授業写真読み込みエラー:',
          error
        );

        setStatus(
          '写真の読み込みでエラーが発生しました'
        );
      }
    };

    loadPhotos();
  }, [subject]);


  const sections: LectureSection[] =
    lectureGroups.map((group, index) => {
      const rows: PhotoRow[] = [];

      for (
        let photoIndex = 0;
        photoIndex < group.photos.length;
        photoIndex += 3
      ) {
        rows.push({
          id: `${group.dateKey}-${photoIndex}`,
          photos: group.photos.slice(
            photoIndex,
            photoIndex + 3
          ),
        });
      }

      return {
        ...group,
        title: `第${index + 1}回`,
        data: rows,
      };
    });


  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      sections={sections}
      keyExtractor={(row) => row.id}
      stickySectionHeadersEnabled={false}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      windowSize={3}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>
            {subject}
          </Text>

          <Text style={styles.status}>
            {status}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          この授業の写真はありません
        </Text>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.lectureHeader}>
          <Text style={styles.lectureTitle}>
            {section.title}
          </Text>

          <Text style={styles.dateText}>
            {section.dateLabel}
          </Text>

          <Text style={styles.photoCount}>
            {section.photos.length}枚
          </Text>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View style={styles.photoRow}>
          {row.photos.map((photo) => (
            <Pressable
              key={photo.id}
              style={styles.photoButton}
              accessibilityRole="button"
              accessibilityLabel="写真を大きく表示"
              onPress={() =>
                router.push({
                  pathname: '/photo/[id]',
                  params: { id: photo.id },
                })
              }
            >
              <Image
                source={{ uri: photo.uri }}
                style={styles.photo}
                contentFit="cover"
                allowDownscaling
                enforceEarlyResizing
                cachePolicy="disk"
                onError={(error) => {
                  console.log(
                    '画像表示エラー:',
                    error.error
                  );
                }}
              />
            </Pressable>
          ))}
        </View>
      )}
      renderSectionFooter={() => (
        <View style={styles.lectureFooter} />
      )}
    />
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'black',
    marginTop: 30,
  },

  status: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    marginBottom: 28,
  },

  emptyText: {
    fontSize: 16,
    color: '#777',
  },

  lectureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  lectureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },

  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },

  photoCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },

  lectureFooter: {
    height: 20,
  },

  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },

  photoButton: {
    width: '31.5%',
    aspectRatio: 1,
  },

  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#eee',
  },
});
