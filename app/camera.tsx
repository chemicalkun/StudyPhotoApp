import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

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


export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);


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
    day: string,
    hour: number,
    minute: number
  ): Promise<ClassInfo> => {
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
    classInfo: ClassInfo
  ) => {
    const id = Date.now().toString();

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
        takenAt: new Date().toISOString(),
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


  const takePicture = async (testMode = false) => {
    if (!cameraRef.current || saving) {
      return;
    }

    setSaving(true);
    setMessage('写真を保存中...');

    try {
      const photo =
        await cameraRef.current.takePictureAsync({
          shutterSound: false,
        });

      if (!photo) {
        throw new Error('撮影データがありません');
      }

      let day: string;
      let hour: number;
      let minute: number;

      if (testMode) {
        day = '月';
        hour = 9;
        minute = 30;
      } else {
        const now = new Date();

        day = dayNames[now.getDay()];
        hour = now.getHours();
        minute = now.getMinutes();
      }

      const classInfo =
        await getClassInfo(day, hour, minute);

      const savedPhoto =
        await savePhoto(photo.uri, classInfo);

      setMessage(
        `写真を保存しました\n${classInfo.label}`
      );

      console.log('保存した写真:', savedPhoto);
    } catch (error) {
      console.log('写真撮影・保存エラー:', error);

      setMessage(
        '写真を保存できませんでした\nもう一度お試しください'
      );
    } finally {
      setSaving(false);
    }
  };


  if (!permission) {
    return <View style={styles.container} />;
  }


  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          写真を撮影するためにカメラへのアクセスが必要です。
        </Text>

        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>
            カメラを許可する
          </Text>
        </Pressable>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      />

      <View style={styles.controls}>
        <Text style={styles.message}>
          {message}
        </Text>

        <Pressable
          style={[
            styles.shutterButton,
            saving && styles.disabledButton,
          ]}
          disabled={saving}
          onPress={() => takePicture(false)}
        >
          <View style={styles.shutterInner} />
        </Pressable>


        <Pressable
          style={[
            styles.testButton,
            saving && styles.disabledButton,
          ]}
          disabled={saving}
          onPress={() => takePicture(true)}
        >
          <Text style={styles.testButtonText}>
            {saving
              ? '保存中...'
              : 'テスト：月曜 9:30として撮影'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({

    libraryButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    },

    libraryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    },

    container: {
        flex: 1,
        backgroundColor: 'black',
    },

  camera: {
    flex: 1,
  },

  controls: {
    height: 260,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },

  disabledButton: {
    opacity: 0.5,
  },

  message: {
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },

  testButton: {
    marginTop: 12,
    padding: 10,
  },

  testButtonText: {
    color: 'white',
    fontSize: 13,
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    padding: 24,
  },

  permissionText: {
    color: 'black',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },

  permissionButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 10,
  },

  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
