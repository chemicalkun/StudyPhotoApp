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

const periodTimes = {
  1: { start: '09:00', end: '10:30' },
  2: { start: '10:40', end: '12:10' },
  3: { start: '13:00', end: '14:30' },
  4: { start: '14:40', end: '16:10' },
  5: { start: '16:20', end: '17:50' },
};

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

  const timeToMinutes = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);

    return hour * 60 + minute;
  };

  const findPeriod = (hour: number, minute: number) => {
    const currentMinutes = hour * 60 + minute;

    for (const [period, time] of Object.entries(periodTimes)) {
      const startMinutes = timeToMinutes(time.start);
      const endMinutes = timeToMinutes(time.end);

      if (
        currentMinutes >= startMinutes &&
        currentMinutes <= endMinutes
      ) {
        return Number(period);
      }
    }

    return null;
  };

  const getClassInfo = async (
    date: Date
  ): Promise<ClassInfo> => {
    const day = dayNames[date.getDay()];
    const hour = date.getHours();
    const minute = date.getMinutes();

    const period = findPeriod(hour, minute);

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
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

      const photos: PhotoRecord[] =
        savedPhotos !== null
        ? JSON.parse(savedPhotos)
        : [];

      const newPhotos = [
        record,
        ...photos,
      ];

      await AsyncStorage.setItem(
        'photos',
        JSON.stringify(newPhotos)
      );

      return record;
    };    

    const pickImage = async () => {
        const permissionResult =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            setMessage('写真ライブラリへのアクセスが必要です');
            return;
        }

      const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 20,
            exif: true,
            quality: 1,
        });

        if (result.canceled) {
            return;
        }

    const classificationResults: string[] = [];

    for (const selectedPhoto of result.assets) {
        if (!selectedPhoto.assetId) {
            classificationResults.push(
            '撮影日時を取得できない写真がありました'
            );
            continue;
        }

        const assetInfo =
            await MediaLibrary.getAssetInfoAsync(
            selectedPhoto.assetId
            );

        const takenAt = new Date(
            assetInfo.creationTime
        );

        const classInfo =
            await getClassInfo(takenAt);

        const savedPhoto =
            await savePhoto(
            selectedPhoto.uri,
            takenAt,
            classInfo
            );

        classificationResults.push(classInfo.label);

        console.log('撮影日時:', takenAt);
        console.log('保存した写真:', savedPhoto);
    }

    setMessage(
        `${result.assets.length}枚を保存しました\n` +
        classificationResults.join('\n')
    );
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
        style={styles.button}
        onPress={pickImage}
      >
        <Text style={styles.buttonText}>
          写真を選択
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

  message: {
    color: 'black',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});
