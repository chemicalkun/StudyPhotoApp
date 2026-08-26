import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router, Stack } from 'expo-router';

import {
  defaultPeriodTimes,
  getPeriodTimesValidationError,
  loadPeriodTimes,
  PeriodTime,
  PeriodTimes,
  periodNumbers,
  savePeriodTimes,
} from '@/utils/period-times';
import {
  classifyClassTime,
  getDayName,
  parseTimetable,
} from '@/utils/classification';


type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
};


const isPhotoRecord = (
  value: unknown
): value is PhotoRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const photo = value as Partial<PhotoRecord>;

  return (
    typeof photo.id === 'string' &&
    typeof photo.uri === 'string' &&
    typeof photo.takenAt === 'string' &&
    typeof photo.day === 'string' &&
    (typeof photo.period === 'number' ||
      photo.period === null) &&
    (typeof photo.subject === 'string' ||
      photo.subject === null)
  );
};


export default function PeriodSettingsScreen() {
  const [periodTimes, setPeriodTimes] =
    useState<PeriodTimes>(defaultPeriodTimes);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');


  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedPeriodTimes =
          await loadPeriodTimes();

        setPeriodTimes(savedPeriodTimes);
      } catch (error) {
        console.log('時限設定読み込みエラー:', error);

        setLoadError(
          '保存済みの時限設定を読み込めませんでした。デフォルト値を表示しています。'
        );
        setPeriodTimes(defaultPeriodTimes);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);


  const updateTime = (
    period: keyof PeriodTimes,
    field: keyof PeriodTime,
    value: string
  ) => {
    setPeriodTimes((currentTimes) => ({
      ...currentTimes,
      [period]: {
        ...currentTimes[period],
        [field]: value,
      },
    }));
  };


  const handleSave = async () => {
    if (saving) {
      return;
    }

    const validationError =
      getPeriodTimesValidationError(periodTimes);

    if (validationError !== null) {
      Alert.alert('時刻を確認してください', validationError);
      return;
    }

    setSaving(true);

    let originalPhotos: string | null = null;
    let photosWereUpdated = false;
    let updatedPhotoCount = 0;

    try {
      const [savedPhotos, savedTimetable] =
        await Promise.all([
          AsyncStorage.getItem('photos'),
          AsyncStorage.getItem('timetable'),
        ]);

      originalPhotos = savedPhotos;

      const timetable =
        parseTimetable(savedTimetable) ?? {};

      if (savedPhotos !== null) {
        const parsedPhotos: unknown =
          JSON.parse(savedPhotos);

        if (
          !Array.isArray(parsedPhotos) ||
          !parsedPhotos.every(isPhotoRecord)
        ) {
          throw new Error('photosの形式が不正です');
        }

        const updatedPhotos = parsedPhotos.map(
          (photo) => {
            const currentTimetableSubject =
              photo.period === null
                ? null
                : timetable[
                    `${photo.day}-${photo.period}`
                  ]?.trim() || null;

            const isAutomaticallyClassified =
              photo.subject === null ||
              photo.subject === '未分類' ||
              (currentTimetableSubject !== null &&
                photo.subject ===
                  currentTimetableSubject);

            if (!isAutomaticallyClassified) {
              return photo;
            }

            const takenAt = new Date(photo.takenAt);

            if (Number.isNaN(takenAt.getTime())) {
              return photo;
            }

            const newClassInfo = classifyClassTime(
              getDayName(takenAt),
              takenAt.getHours(),
              takenAt.getMinutes(),
              periodTimes,
              timetable
            );

            const shouldUpdate =
              photo.day !== newClassInfo.day ||
              photo.period !== newClassInfo.period ||
              photo.subject !== newClassInfo.subject;

            if (!shouldUpdate) {
              return photo;
            }

            updatedPhotoCount += 1;

            return {
              ...photo,
              day: newClassInfo.day,
              period: newClassInfo.period,
              subject: newClassInfo.subject,
            };
          }
        );

        if (updatedPhotoCount > 0) {
          await AsyncStorage.setItem(
            'photos',
            JSON.stringify(updatedPhotos)
          );

          photosWereUpdated = true;
        }
      }

      await savePeriodTimes(periodTimes);

      if (updatedPhotoCount > 0) {
        Alert.alert(
          '時限設定を保存しました',
          `既存の写真${updatedPhotoCount}枚を新しい時刻に合わせて再分類しました。`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        router.back();
      }
    } catch (error) {
      console.log('時限設定保存エラー:', error);

      if (photosWereUpdated && originalPhotos !== null) {
        try {
          await AsyncStorage.setItem(
            'photos',
            originalPhotos
          );
        } catch (rollbackError) {
          console.log(
            '写真再分類の復元エラー:',
            rollbackError
          );
        }
      }

      Alert.alert(
        '時限設定を保存できませんでした',
        '保存中にエラーが発生しました。写真データは変更されていません。'
      );
    } finally {
      setSaving(false);
    }
  };


  const confirmReset = () => {
    Alert.alert(
      'デフォルトの時刻に戻しますか？',
      '「保存」を押すまで変更は確定しません。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '戻す',
          onPress: () => {
            setPeriodTimes(defaultPeriodTimes);
          },
        },
      ]
    );
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: '時限設定' }} />

      <Text style={styles.title}>
        時限設定
      </Text>

      <Text style={styles.description}>
        各時限の開始と終了を24時間表記のHH:mm形式で入力してください。
      </Text>

      {loadError !== '' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {loadError}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#333"
        />
      ) : (
        <>
          {periodNumbers.map((period) => (
            <View key={period} style={styles.periodRow}>
              <Text style={styles.periodLabel}>
                {period}限
              </Text>

              <TextInput
                style={styles.timeInput}
                value={periodTimes[period].start}
                onChangeText={(value) =>
                  updateTime(period, 'start', value)
                }
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                maxLength={5}
                editable={!saving}
              />

              <Text style={styles.separator}>
                〜
              </Text>

              <TextInput
                style={styles.timeInput}
                value={periodTimes[period].end}
                onChangeText={(value) =>
                  updateTime(period, 'end', value)
                }
                placeholder="10:30"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                maxLength={5}
                editable={!saving}
              />
            </View>
          ))}

          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            disabled={saving}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>
              {saving ? '保存中...' : '保存'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.resetButton}
            disabled={saving}
            onPress={confirmReset}
          >
            <Text style={styles.resetButtonText}>
              デフォルトに戻す
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    color: 'black',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 20,
  },

  description: {
    color: '#555',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 24,
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

  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  periodLabel: {
    width: 44,
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },

  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: 'black',
    fontSize: 16,
    textAlign: 'center',
  },

  separator: {
    color: '#555',
    fontSize: 18,
    marginHorizontal: 8,
  },

  saveButton: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 15,
    marginTop: 18,
  },

  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  resetButton: {
    padding: 14,
    marginTop: 8,
  },

  resetButtonText: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.5,
  },
});
