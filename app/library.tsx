import { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

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

export default function LibraryScreen() {
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [settingsRequired, setSettingsRequired] =
    useState(false);

  const pickImage = async () => {
    if (importing) {
      return;
    }

    setImporting(true);

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setSettingsRequired(
          !permissionResult.canAskAgain
        );
        setMessage(
          permissionResult.canAskAgain
            ? '写真ライブラリへのアクセスが必要です'
            : 'iPhoneの設定から写真ライブラリへのアクセスを許可してください'
        );
        return;
      }

      setSettingsRequired(false);

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

      const [configuredPeriodTimes, savedTimetable] =
        await Promise.all([
          loadPeriodTimes(),
          AsyncStorage.getItem('timetable'),
        ]);
      const timetable = parseTimetable(savedTimetable);

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

          const classInfo = classifyClassTime(
            getDayName(takenAt),
            takenAt.getHours(),
            takenAt.getMinutes(),
            configuredPeriodTimes,
            timetable
          );

          const savedPhoto = await savePhotoFromUri({
            sourceUri: selectedPhoto.uri,
            takenAt,
            day: classInfo.day,
            period: classInfo.period,
            subject: classInfo.subject,
          });

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

      {settingsRequired ? (
        <Pressable
          style={styles.settingsButton}
          accessibilityRole="button"
          onPress={() => {
            void Linking.openSettings();
          }}
        >
          <Text style={styles.settingsButtonText}>
            iPhoneの設定を開く
          </Text>
        </Pressable>
      ) : null}
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

  settingsButton: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 14,
  },

  settingsButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
