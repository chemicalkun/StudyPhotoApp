import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
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
  loadPeriodTimes,
} from '@/utils/period-times';
import {
  classifyClassTime,
  getDayName,
  parseTimetable,
} from '@/utils/classification';
import { savePhotoFromUri } from '@/services/photo-storage';
import { loadTimetableDisplayOptions } from '@/utils/timetable-display-options';


export default function CameraScreen() {
  const [
    permission,
    requestPermission,
    getPermission,
  ] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          void getPermission();
        }
      }
    );

    return () => subscription.remove();
  }, [getPermission]);


  const takePicture = async () => {
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

      const now = new Date();
      const day = getDayName(now);
      const hour = now.getHours();
      const minute = now.getMinutes();

      const [
        configuredPeriodTimes,
        savedTimetable,
        displayOptions,
      ] =
        await Promise.all([
          loadPeriodTimes(),
          AsyncStorage.getItem('timetable'),
          loadTimetableDisplayOptions(),
        ]);
      const timetable = parseTimetable(savedTimetable);

      const classInfo = classifyClassTime(
        day,
        hour,
        minute,
        configuredPeriodTimes,
        timetable,
        displayOptions
      );

      const savedPhoto = await savePhotoFromUri({
        sourceUri: photo.uri,
        takenAt: new Date(),
        day: classInfo.day,
        period: classInfo.period,
        subject: classInfo.subject,
      });

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
          {permission.canAskAgain
            ? '写真を撮影するためにカメラへのアクセスが必要です。'
            : 'iPhoneの設定からStudyPhotoのカメラアクセスを許可してください。'}
        </Text>

        <Pressable
          style={styles.permissionButton}
          onPress={() => {
            if (permission.canAskAgain) {
              void requestPermission();
              return;
            }

            void Linking.openSettings();
          }}
        >
          <Text style={styles.buttonText}>
            {permission.canAskAgain
              ? 'カメラを許可する'
              : 'iPhoneの設定を開く'}
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
          onPress={() => void takePicture()}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
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
