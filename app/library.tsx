import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import {
  findPeriod,
  loadPeriodTimes,
  PeriodTimes,
} from '@/utils/period-times';

const dayNames = ['', '月', '火', '水', '木', '金', ''];

type ClassInfo = {
  day: string;
  period: number | null;
  subject: string | null;
  label: string;
};

type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
};

export default function LibraryScreen() {
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);

  const getClassInfo = async (
    date: Date,
    periodTimes: PeriodTimes
  ): Promise<ClassInfo> => {
    const day = dayNames[date.getDay()];
    const hour = date.getHours();
    const minute = date.getMinutes();

    const period = findPeriod(
      hour,
      minute,
      periodTimes
    );

    if (period === null) {
      return {
        day,
        period: null,
        subject: null,
        label: '授業時間外',
      };
    }

    if (day === '') {
      return {
        day,
        period,
        subject: null,
        label: '土日は授業なし',
      };
    }

    const savedTimetable =
      await AsyncStorage.getItem('timetable');

    if (savedTimetable === null) {
      return {
        day,
        period,
        subject: null,
        label: '時間割未登録',
      };
    }

    const timetable: Record<string, string> =
      JSON.parse(savedTimetable);

    const key = `${day}-${period}`;
    const subject = timetable[key] ?? null;

    if (subject === null) {
      return {
        day,
        period,
        subject: null,
        label: `${day}曜日 ${period}限：授業未登録`,
      };
    }

    return {
      day,
      period,
      subject,
      label: `${day}曜日 ${period}限：${subject}`,
    };
  };


  const savePhoto = async (
    photoUri: string,
    takenAt: Date,
    classInfo: ClassInfo
  ) => {
    const id =
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const photosDirectory = new Directory(
      Paths.document,
      'studyphoto-photos'
    );

    photosDirectory.create({
      idempotent: true,
      intermediates: true,
    });

    const sourceFile = new File(photoUri);

    const savedFile = new File(
      photosDirectory,
      `${id}.jpg`
    );

    try {
      sourceFile.copy(savedFile);

      const record: PhotoRecord = {
        id,
        uri: savedFile.uri,
        takenAt: takenAt.toISOString(),
        day: classInfo.day,
        period: classInfo.period,
        subject: classInfo.subject,
      };

      const savedPhotos =
        await AsyncStorage.getItem('photos');

      let photos: PhotoRecord[] = [];

      if (savedPhotos !== null) {
        const parsedPhotos: unknown =
          JSON.parse(savedPhotos);

        if (!Array.isArray(parsedPhotos)) {
          throw new Error(
            'photosが配列ではありません'
          );
        }

        photos = parsedPhotos as PhotoRecord[];
      }

      const newPhotos = [
        record,
        ...photos,
      ];

      await AsyncStorage.setItem(
        'photos',
        JSON.stringify(newPhotos)
      );

      return record;
    } catch (error) {
      try {
        if (savedFile.exists) {
          savedFile.delete();
        }
      } catch (cleanupError) {
        console.log(
          '写真ファイル後片付けエラー:',
          cleanupError
        );
      }

      throw error;
    }
  };


  const pickImage = async () => {
    if (importing) {
      return;
    }

    setImporting(true);

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setMessage(
          '写真ライブラリへのアクセスが必要です'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: 20,
          exif: true,
          quality: 1,
        });

      if (result.canceled) {
        return;
      }

      const configuredPeriodTimes =
        await loadPeriodTimes();

      let savedCount = 0;
      let failedCount = 0;
      const classificationResults: string[] = [];

      for (
        let index = 0;
        index < result.assets.length;
        index += 1
      ) {
        const selectedPhoto = result.assets[index];

        setMessage(
          `${index + 1}/${result.assets.length}枚を処理中...`
        );

        if (!selectedPhoto.assetId) {
          failedCount += 1;
          classificationResults.push(
            '撮影日時を取得できず、保存できませんでした'
          );
          continue;
        }

        try {
          const assetInfo =
            await MediaLibrary.getAssetInfoAsync(
              selectedPhoto.assetId
            );

          const takenAt = new Date(
            assetInfo.creationTime
          );

          if (Number.isNaN(takenAt.getTime())) {
            throw new Error('撮影日時が不正です');
          }

          const classInfo =
            await getClassInfo(
              takenAt,
              configuredPeriodTimes
            );

          const savedPhoto =
            await savePhoto(
              selectedPhoto.uri,
              takenAt,
              classInfo
            );

          savedCount += 1;
          classificationResults.push(classInfo.label);

          console.log('撮影日時:', takenAt);
          console.log('保存した写真:', savedPhoto);
        } catch (photoError) {
          failedCount += 1;
          classificationResults.push(
            '1枚の写真を保存できませんでした'
          );

          console.log(
            'ライブラリ写真保存エラー:',
            photoError
          );
        }
      }

      const summary = [
        `${savedCount}枚を保存しました`,
      ];

      if (failedCount > 0) {
        summary.push(
          `${failedCount}枚は保存できませんでした`
        );
      }

      setMessage(
        [...summary, ...classificationResults]
          .join('\n')
      );
    } catch (error) {
      console.log(
        '写真ライブラリ処理エラー:',
        error
      );

      setMessage(
        '写真ライブラリの処理に失敗しました\nもう一度お試しください'
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        写真ライブラリ
      </Text>

      <Text style={styles.description}>
        授業中に撮影した写真を選択します。
      </Text>

      <Pressable
        style={[
          styles.button,
          importing && styles.disabledButton,
        ]}
        disabled={importing}
        onPress={pickImage}
      >
        <Text style={styles.buttonText}>
          {importing ? '処理中...' : '写真を選択'}
        </Text>
      </Pressable>

      <Text style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 24,
    paddingTop: 60,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 12,
  },

  description: {
    fontSize: 16,
    color: '#555',
    marginBottom: 30,
  },

  button: {
    backgroundColor: '#333',
    padding: 18,
    borderRadius: 12,
  },

  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.5,
  },

  message: {
    color: 'black',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});
