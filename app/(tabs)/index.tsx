import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LoadErrorCard } from '@/components/load-error-card';
import { loadAcademicTerm } from '@/services/academic-term-storage';
import { hasSeenGettingStartedGuide } from '@/services/getting-started-storage';
import {
  formatAcademicTerm,
  getDefaultAcademicTerm,
  type AcademicTerm,
} from '@/types/academic-term';
import {
  groupPhotosBySubject,
  getLatestPhotoTakenAt,
  getPhotoLectureCount,
  isUnclassifiedPhoto,
  parsePhotoRecords,
  PhotoRecord,
} from '@/types/photo';
import {
  parseTimetable,
  type Timetable,
} from '@/utils/classification';
import {
  getTimetableSubjectSlots,
  getUniqueTimetableSubjects,
} from '@/utils/timetable-subject';
import { timetableDays } from '@/utils/timetable-recognition';


export default function HomeScreen() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [academicTerm, setAcademicTerm] =
    useState<AcademicTerm>(getDefaultAcademicTerm());
  const [timetable, setTimetable] =
    useState<Timetable>({});
  const [loadError, setLoadError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);


  useEffect(() => {
    let active = true;

    const openGettingStartedGuide = async () => {
      try {
        const hasSeenGuide =
          await hasSeenGettingStartedGuide();

        if (active && !hasSeenGuide) {
          router.push({
            pathname: '/getting-started',
            params: { from: 'onboarding' },
          });
        }
      } catch (error) {
        console.log('初回ガイド確認エラー:', error);
      }
    };

    void openGettingStartedGuide();

    return () => {
      active = false;
    };
  }, []);


  useFocusEffect(
    useCallback(() => {
      // Incrementing this value retries the focus-time load.
      void loadRevision;
      let active = true;

      const loadHomeData = async () => {
        try {
          setLoadError('');

          const [
            savedPhotos,
            savedTimetable,
            savedAcademicTerm,
          ] =
            await Promise.all([
              AsyncStorage.getItem('photos'),
              AsyncStorage.getItem('timetable'),
              loadAcademicTerm(),
            ]);

          if (!active) {
            return;
          }

          setPhotos(
            savedPhotos === null
              ? []
              : parsePhotoRecords(savedPhotos)
          );
          setAcademicTerm(savedAcademicTerm);
          setTimetable(
            parseTimetable(savedTimetable) ?? {}
          );
        } catch (error) {
          console.log(
            'ホーム写真読み込みエラー:',
            error
          );

          if (active) {
            setPhotos([]);
            setTimetable({});
            setLoadError(
              'ホームのデータを読み込めませんでした。データは削除されていません。'
            );
          }
        }
      };

      void loadHomeData();

      return () => {
        active = false;
      };
    }, [loadRevision])
  );


  const unclassifiedPhotos = photos.filter(
    isUnclassifiedPhoto
  );
  const latestUnclassifiedPhotoTakenAt =
    getLatestPhotoTakenAt(unclassifiedPhotos);
  const latestUnclassifiedPhotoLabel =
    latestUnclassifiedPhotoTakenAt === null
      ? null
      : new Date(
          latestUnclassifiedPhotoTakenAt
        ).toLocaleDateString('ja-JP', {
          month: 'numeric',
          day: 'numeric',
        });


  const photosBySubject = groupPhotosBySubject(photos);
  const subjectGroups = [
    ...new Set([
      ...getUniqueTimetableSubjects(timetable),
      ...Object.keys(photosBySubject),
    ]),
  ].map((subject) => [
    subject,
    photosBySubject[subject] ?? [],
  ] as const).sort(([firstSubject], [secondSubject]) => {
    const firstSlot = getTimetableSubjectSlots(
      timetable,
      firstSubject
    )[0];
    const secondSlot = getTimetableSubjectSlots(
      timetable,
      secondSubject
    )[0];

    if (firstSlot === undefined) {
      return secondSlot === undefined
        ? firstSubject.localeCompare(secondSubject, 'ja')
        : 1;
    }

    if (secondSlot === undefined) {
      return -1;
    }

    const firstDayIndex = timetableDays.indexOf(
      firstSlot.day
    );
    const secondDayIndex = timetableDays.indexOf(
      secondSlot.day
    );

    return firstDayIndex !== secondDayIndex
      ? firstDayIndex - secondDayIndex
      : firstSlot.period - secondSlot.period;
  });


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        StudyPhoto
      </Text>

      <Text style={styles.subtitle}>
        講義写真を自動で整理
      </Text>

      <Pressable
        style={styles.academicTermButton}
        accessibilityRole="button"
        accessibilityLabel={`${formatAcademicTerm(academicTerm)}、学期を変更`}
        onPress={() => router.push({
          pathname: '/academic-term',
          params: { from: 'home' },
        })}
      >
        <Text style={styles.academicTermText}>
          {formatAcademicTerm(academicTerm)}
        </Text>
        <Text style={styles.academicTermArrow}>
          変更 ›
        </Text>
      </Pressable>


      {loadError !== '' ? (
        <LoadErrorCard
          message={loadError}
          onRetry={() => {
            setLoadRevision((revision) => revision + 1);
          }}
        />
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

      <Pressable
        style={styles.settingsButton}
        accessibilityRole="button"
        accessibilityLabel="設定を開く"
        onPress={() => router.push('/settings')}
      >
        <Text style={styles.settingsButtonText}>
          設定
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
                {getPhotoLectureCount(unclassifiedPhotos)}日分・
                {unclassifiedPhotos.length}枚
              </Text>

              <Text style={styles.unclassifiedHint}>
                {latestUnclassifiedPhotoLabel === null
                  ? '授業名を確認して整理できます'
                  : `最新：${latestUnclassifiedPhotoLabel}・授業名を確認して整理`}
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
            ([subject, subjectPhotos]) => {
              const subjectSlots =
                getTimetableSubjectSlots(
                  timetable,
                  subject
                );
              const firstSubjectSlot = subjectSlots[0];
              const subjectSlotLabel =
                firstSubjectSlot === undefined
                  ? ''
                  : `${firstSubjectSlot.day}曜${firstSubjectSlot.period}限${
                      subjectSlots.length > 1
                        ? `・ほか${subjectSlots.length - 1}コマ`
                        : ''
                    } / `;

              return (
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
                    {subjectSlotLabel}
                    {getPhotoLectureCount(subjectPhotos)}回分・
                    {subjectPhotos.length}枚
                  </Text>
                </View>

                <Text style={styles.arrow}>
                  ›
                </Text>
                </Pressable>
              );
            }
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
    marginBottom: 8,
  },

  academicTermButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef2fb',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 26,
  },

  academicTermText: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
  },

  academicTermArrow: {
    color: '#5670a8',
    fontSize: 12,
    fontWeight: 'bold',
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
    marginBottom: 12,
  },

  backupButtonText: {
    color: '#31518f',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  settingsButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#c5c8ce',
    borderRadius: 12,
    backgroundColor: '#f5f6f8',
    marginBottom: 32,
  },

  settingsButtonText: {
    color: '#444',
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
