import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';

import {
  defaultPeriodTimes,
  loadPeriodTimes,
  periodNumbers,
  PeriodTimes,
} from '@/utils/period-times';
import { isTimetable } from '@/utils/classification';
import { parsePhotoRecords } from '@/types/photo';

const days = ['月', '火', '水', '木', '金'];


export default function TimetableScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingClass, setDeletingClass] =
    useState(false);
  const [loadError, setLoadError] = useState('');
  const [periodTimesError, setPeriodTimesError] =
    useState('');

  const [selectedDay, setSelectedDay] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  const [subjectName, setSubjectName] = useState('');

  const [timetable, setTimetable] = useState<Record<string, string>>({});
  const [periodTimes, setPeriodTimes] =
    useState<PeriodTimes>(defaultPeriodTimes);


  useEffect(() => {
    const loadTimetable = async () => {
      try {
        setLoadError('');

        const savedTimetable =
          await AsyncStorage.getItem('timetable');

        if (savedTimetable === null) {
          setTimetable({});
          return;
        }

        const parsedTimetable: unknown =
          JSON.parse(savedTimetable);

        if (!isTimetable(parsedTimetable)) {
          throw new Error(
            'timetableの形式が不正です'
          );
        }

        setTimetable(parsedTimetable);
      } catch (error) {
        console.log('時間割読み込みエラー:', error);

        setTimetable({});
        setLoadError(
          '時間割データを読み込めませんでした。データは削除されていません。画面を開き直してください。'
        );
      }
    };

    loadTimetable();
  }, []);


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadSettings = async () => {
        try {
          const savedPeriodTimes =
            await loadPeriodTimes();

          if (active) {
            setPeriodTimes(savedPeriodTimes);
            setPeriodTimesError('');
          }
        } catch (error) {
          console.log('時限設定読み込みエラー:', error);

          if (active) {
            setPeriodTimes(defaultPeriodTimes);
            setPeriodTimesError(
              '時限設定を読み込めなかったため、デフォルト時刻を表示しています。'
            );
          }
        }
      };

      loadSettings();

      return () => {
        active = false;
      };
    }, [])
  );


  const handlePress = (day: string, period: number) => {
    if (loadError !== '') {
      return;
    }

    setSelectedDay(day);
    setSelectedPeriod(period);

    const key = `${day}-${period}`;

    setSubjectName(timetable[key] ?? '');

    setModalVisible(true);
  };


  const handleSave = async () => {
    if (
      selectedPeriod === null ||
      saving ||
      deletingClass
    ) {
      return;
    }

    const key = `${selectedDay}-${selectedPeriod}`;
    const normalizedSubject = subjectName.trim();
    const previousSubject =
      timetable[key]?.trim() ?? '';

    if (normalizedSubject === '') {
      Alert.alert(
        '授業名を入力してください',
        '登録済みの授業は「この授業を削除」から削除できます。'
      );
      return;
    }

    const newTimetable = {
      ...timetable,
      [key]: normalizedSubject,
    };

    setSaving(true);

    let originalPhotos: string | null = null;
    let photosWereUpdated = false;
    let updatedPhotoCount = 0;

    try {
      originalPhotos =
        await AsyncStorage.getItem('photos');

      if (
        normalizedSubject !== '' &&
        originalPhotos !== null
      ) {
        const parsedPhotos =
          parsePhotoRecords(originalPhotos);

        const updatedPhotos = parsedPhotos.map(
          (photo) => {
            const isSameClassTime =
              photo.day === selectedDay &&
              photo.period === selectedPeriod;

            const isUnclassified =
              photo.subject === null ||
              photo.subject === '未分類';

            const hasPreviousSubject =
              previousSubject !== '' &&
              photo.subject === previousSubject;

            const shouldClassify =
              isSameClassTime &&
              photo.subject !== normalizedSubject &&
              (isUnclassified || hasPreviousSubject);

            if (!shouldClassify) {
              return photo;
            }

            updatedPhotoCount += 1;

            return {
              ...photo,
              subject: normalizedSubject,
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

      await AsyncStorage.setItem(
        'timetable',
        JSON.stringify(newTimetable)
      );

      setTimetable(newTimetable);
      setLoadError('');
      setModalVisible(false);

      if (updatedPhotoCount > 0) {
        Alert.alert(
          '時間割を保存しました',
          `既存の写真${updatedPhotoCount}枚を「${normalizedSubject}」に更新しました。`
        );
      }
    } catch (error) {
      console.log('時間割保存エラー:', error);

      if (photosWereUpdated && originalPhotos !== null) {
        try {
          await AsyncStorage.setItem(
            'photos',
            originalPhotos
          );
        } catch (rollbackError) {
          console.log(
            '写真分類の復元エラー:',
            rollbackError
          );
        }
      }

      Alert.alert(
        '時間割を保存できませんでした',
        '時間割の保存中にエラーが発生しました。もう一度お試しください。'
      );
    } finally {
      setSaving(false);
    }
  };


  const deleteClass = async () => {
    if (
      selectedPeriod === null ||
      saving ||
      deletingClass
    ) {
      return;
    }

    const key = `${selectedDay}-${selectedPeriod}`;
    const deletedSubject =
      timetable[key]?.trim() ?? '';

    if (deletedSubject === '') {
      return;
    }

    const newTimetable = { ...timetable };
    delete newTimetable[key];

    setDeletingClass(true);

    let originalPhotos: string | null = null;
    let photosWereUpdated = false;
    let updatedPhotoCount = 0;

    try {
      originalPhotos =
        await AsyncStorage.getItem('photos');

      if (originalPhotos !== null) {
        const parsedPhotos =
          parsePhotoRecords(originalPhotos);

        const updatedPhotos = parsedPhotos.map(
          (photo) => {
            const shouldUnclassify =
              photo.day === selectedDay &&
              photo.period === selectedPeriod &&
              photo.subject === deletedSubject;

            if (!shouldUnclassify) {
              return photo;
            }

            updatedPhotoCount += 1;

            return {
              ...photo,
              subject: null,
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

      await AsyncStorage.setItem(
        'timetable',
        JSON.stringify(newTimetable)
      );

      setTimetable(newTimetable);
      setModalVisible(false);

      Alert.alert(
        '授業を削除しました',
        updatedPhotoCount > 0
          ? `既存の写真${updatedPhotoCount}枚を曜日・時限の仮分類に戻しました。`
          : '時間割から授業を削除しました。'
      );
    } catch (error) {
      console.log('授業削除エラー:', error);

      if (photosWereUpdated && originalPhotos !== null) {
        try {
          await AsyncStorage.setItem(
            'photos',
            originalPhotos
          );
        } catch (rollbackError) {
          console.log(
            '写真分類の復元エラー:',
            rollbackError
          );
        }
      }

      Alert.alert(
        '授業を削除できませんでした',
        '時間割の更新中にエラーが発生しました。'
      );
    } finally {
      setDeletingClass(false);
    }
  };


  const confirmDeleteClass = () => {
    if (selectedPeriod === null) {
      return;
    }

    const key = `${selectedDay}-${selectedPeriod}`;
    const deletedSubject =
      timetable[key]?.trim() ?? '';

    if (deletedSubject === '') {
      return;
    }

    Alert.alert(
      `「${deletedSubject}」を削除しますか？`,
      'この曜日・時限の既存写真は、曜日・時限の仮分類に戻ります。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: deleteClass,
        },
      ]
    );
  };


  const selectedTimetableKey =
    selectedPeriod !== null
      ? `${selectedDay}-${selectedPeriod}`
      : '';

  const selectedExistingSubject =
    selectedTimetableKey !== ''
      ? timetable[selectedTimetableKey]?.trim() ?? ''
      : '';

  const updating = saving || deletingClass;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>時間割</Text>

      {loadError !== '' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {loadError}
          </Text>
        </View>
      ) : null}

      {periodTimesError !== '' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {periodTimesError}
          </Text>
        </View>
      ) : null}

      <Pressable
        style={styles.imageImportButton}
        onPress={() => router.push('/timetable-import')}
      >
        <Text style={styles.imageImportButtonText}>
          🖼️ 時間割画像から登録
        </Text>
      </Pressable>

      <Pressable
        style={styles.periodSettingsButton}
        onPress={() => router.push('/period-settings')}
      >
        <Text style={styles.periodSettingsButtonText}>
          ⏰ 時限の開始・終了時刻を変更
        </Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View style={styles.cornerHeader} />

        {days.map((day) => (
          <View key={day} style={styles.dayHeader}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>

      {periodNumbers.map((period) => (
        <View key={period} style={styles.row}>
          <View style={styles.periodHeader}>
            <Text style={styles.headerText}>
              {period}限
            </Text>

            <Text style={styles.periodTime}>
              {periodTimes[
                period
              ].start}
            </Text>

            <Text style={styles.periodTime}>
              〜{periodTimes[
                period
              ].end}
            </Text>
          </View>

          {days.map((day) => {
            const key = `${day}-${period}`;
            const subject = timetable[key];

            return (
              <Pressable
                key={key}
                style={[
                  styles.cell,
                  loadError !== '' &&
                    styles.disabledButton,
                ]}
                disabled={loadError !== ''}
                onPress={() =>
                  handlePress(day, period)
                }
              >
                <Text style={styles.cellText}>
                  {subject || '＋'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!updating) {
            setModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDay}曜日 {selectedPeriod}限
            </Text>

            <Text style={styles.label}>授業名</Text>

            <TextInput
              style={styles.input}
              value={subjectName}
              onChangeText={setSubjectName}
              placeholder="例：高分子化学"
              editable={!updating}
            />

            <Pressable
              style={[
                styles.saveButton,
                updating && styles.disabledButton,
              ]}
              disabled={updating}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>
                {saving ? '保存中...' : '保存'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              disabled={updating}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </Pressable>

            {selectedExistingSubject !== '' ? (
              <Pressable
                style={[
                  styles.deleteClassButton,
                  updating && styles.disabledButton,
                ]}
                disabled={updating}
                onPress={confirmDeleteClass}
              >
                <Text style={styles.deleteClassButtonText}>
                  {deletingClass
                    ? '削除中...'
                    : 'この授業を削除'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'black',
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

  periodTime: {
    fontSize: 9,
    color: '#666',
  },

  imageImportButton: {
    backgroundColor: '#2454a6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  imageImportButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  periodSettingsButton: {
    backgroundColor: '#eef3ff',
    borderWidth: 1,
    borderColor: '#9eb8ef',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },

  periodSettingsButtonText: {
    color: '#2454a6',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  headerRow: {
    flexDirection: 'row',
  },

  row: {
    flexDirection: 'row',
  },

  periodHeader: {
    width: 50,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#aaa',
  },

  dayHeader: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#aaa',
  },

  headerText: {
    fontWeight: 'bold',
    color: 'black',
  },

  cell: {
    flex: 1,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#aaa',
    padding: 4,
  },

  cellText: {
    fontSize: 13,
    color: 'black',
    textAlign: 'center',
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },

  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 24,
  },

  label: {
    fontSize: 16,
    color: 'black',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: 'black',
    marginBottom: 20,
  },

  saveButton: {
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },

  saveButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.5,
  },

  cancelButton: {
    padding: 12,
  },

  cornerHeader: {
    width: 50,
    height: 50,
    borderWidth: 0.5,
    borderColor: '#aaa',
  },

  cancelButtonText: {
    color: 'black',
    textAlign: 'center',
  },

  deleteClassButton: {
    borderWidth: 1,
    borderColor: '#d64545',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },

  deleteClassButtonText: {
    color: '#c83232',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
