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

import {
  parsePhotoRecords,
  PhotoRecord,
} from '@/types/photo';


export default function HomeScreen() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loadError, setLoadError] = useState('');


  useFocusEffect(
    useCallback(() => {
      const loadPhotos = async () => {
        try {
          setLoadError('');

          const savedPhotos =
            await AsyncStorage.getItem('photos');

          if (savedPhotos === null) {
            setPhotos([]);
            return;
          }

          setPhotos(parsePhotoRecords(savedPhotos));
        } catch (error) {
          console.log(
            'ホーム写真読み込みエラー:',
            error
          );

          setPhotos([]);
          setLoadError(
            '写真データを読み込めませんでした。データは削除されていません。'
          );
        }
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


  const unclassifiedPhotos = photos.filter(
    (photo) =>
      photo.subject === null ||
      photo.subject === '未分類'
  );


  const subjectGroups = Object.entries(
    groupedPhotos
  ).filter(([subject]) => subject !== '未分類');


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        StudyPhoto
      </Text>

      <Text style={styles.subtitle}>
        講義写真を自動で整理
      </Text>


      {loadError !== '' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {loadError}
          </Text>
        </View>
      ) : null}


      <Pressable
        style={styles.mainButton}
        onPress={() => router.push('/camera')}
      >
        <Text style={styles.buttonText}>
          写真を撮る
        </Text>
      </Pressable>


      <Pressable
        style={styles.mainButton}
        onPress={() => router.push('/library')}
      >
        <Text style={styles.buttonText}>
          ライブラリから選択
        </Text>
      </Pressable>


      <Pressable
        style={styles.timetableButton}
        onPress={() => router.push('/timetable')}
      >
        <Text style={styles.buttonText}>
          時間割
        </Text>
      </Pressable>


      <Pressable
        style={styles.backupButton}
        onPress={() => router.push('/backup')}
      >
        <Text style={styles.backupButtonText}>
          バックアップ
        </Text>
      </Pressable>


      {unclassifiedPhotos.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            未分類
          </Text>

          <Pressable
            style={[
              styles.subjectCard,
              styles.unclassifiedCard,
            ]}
            onPress={() =>
              router.push({
                pathname: '/subject/[subject]',
                params: { subject: '未分類' },
              })
            }
          >
            <View>
              <Text style={styles.subjectName}>
                未分類の写真
              </Text>

              <Text style={styles.subjectCount}>
                {unclassifiedPhotos.length}枚
              </Text>

              <Text style={styles.unclassifiedHint}>
                授業名を確認して整理できます
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>
        </>
      ) : null}


      <Text
        style={[
          styles.sectionTitle,
          unclassifiedPhotos.length > 0 &&
            styles.subjectSectionTitle,
        ]}
      >
        授業
      </Text>


      {subjectGroups.length === 0 ? (
        <Text style={styles.emptyText}>
          まだ授業の写真がありません
        </Text>
      ) : (
        <View style={styles.subjectList}>
          {subjectGroups.map(
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

  errorBox: {
    backgroundColor: '#ffe8e8',
    borderWidth: 1,
    borderColor: '#e39a9a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    color: '#8a2020',
    fontSize: 14,
    lineHeight: 20,
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
    marginBottom: 12,
  },

  backupButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#9aa9c8',
    borderRadius: 12,
    backgroundColor: '#f3f6ff',
    marginBottom: 32,
  },

  backupButtonText: {
    color: '#31518f',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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

  subjectSectionTitle: {
    marginTop: 28,
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

  unclassifiedCard: {
    backgroundColor: '#fff3d6',
    borderWidth: 1,
    borderColor: '#f0c96d',
  },

  unclassifiedHint: {
    fontSize: 13,
    color: '#725b24',
    marginTop: 6,
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
