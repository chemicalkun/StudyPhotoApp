import { useEffect, useState } from 'react';
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

const days = ['月', '火', '水', '木', '金'];
const periods = [1, 2, 3, 4, 5];
const periodTimes = {
  1: { start: '09:00', end: '10:30' },
  2: { start: '10:40', end: '12:10' },
  3: { start: '13:00', end: '14:30' },
  4: { start: '14:40', end: '16:10' },
  5: { start: '16:20', end: '17:50' },
};


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


const isTimetable = (
  value: unknown
): value is Record<string, string> => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  return Object.values(value).every(
    (subject) => typeof subject === 'string'
  );
};


export default function TimetableScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingClass, setDeletingClass] =
    useState(false);
  const [loadError, setLoadError] = useState('');

  const [selectedDay, setSelectedDay] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  const [subjectName, setSubjectName] = useState('');

  const [timetable, setTimetable] = useState<Record<string, string>>({});


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
        const parsedPhotos: unknown =
          JSON.parse(originalPhotos);

        if (
          !Array.isArray(parsedPhotos) ||
          !parsedPhotos.every(isPhotoRecord)
        ) {
          throw new Error(
            'photosの形式が不正です'
          );
        }

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
        const parsedPhotos: unknown =
          JSON.parse(originalPhotos);

        if (
          !Array.isArray(parsedPhotos) ||
          !parsedPhotos.every(isPhotoRecord)
        ) {
          throw new Error(
            'photosの形式が不正です'
          );
        }

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

      <View style={styles.headerRow}>
        <View style={styles.cornerHeader} />

        {days.map((day) => (
          <View key={day} style={styles.dayHeader}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>

      {periods.map((period) => (
        <View key={period} style={styles.row}>
          <View style={styles.periodHeader}>
            <Text style={styles.headerText}>
              {period}限
            </Text>

            <Text style={styles.periodTime}>
              {periodTimes[
                period as keyof typeof periodTimes
              ].start}
            </Text>

            <Text style={styles.periodTime}>
              〜{periodTimes[
                period as keyof typeof periodTimes
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
