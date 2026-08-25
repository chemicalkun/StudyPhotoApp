import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import {
  router,
  Stack,
  useLocalSearchParams,
} from 'expo-router';


type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
};


export default function PhotoScreen() {
  const params = useLocalSearchParams();

  const photoId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [photo, setPhoto] =
    useState<PhotoRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');


  useEffect(() => {
    const loadPhoto = async () => {
      try {
        const savedPhotos =
          await AsyncStorage.getItem('photos');

        if (savedPhotos === null) {
          setErrorMessage('写真データがありません');
          return;
        }

        const photos: PhotoRecord[] =
          JSON.parse(savedPhotos);

        const selectedPhoto =
          photos.find((item) => {
            return item.id === photoId;
          });

        if (!selectedPhoto) {
          setErrorMessage('写真が見つかりません');
          return;
        }

        setPhoto(selectedPhoto);
      } catch (error) {
        console.log('写真読み込みエラー:', error);
        setErrorMessage('写真の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadPhoto();
  }, [photoId]);


  const getPhotoLabel = (record: PhotoRecord) => {
    if (record.subject) {
      return record.subject;
    }

    if (
      record.period !== null &&
      record.day !== ''
    ) {
      return `${record.day}曜${record.period}限`;
    }

    return '未分類';
  };


  const getTakenAtLabel = (takenAt: string) => {
    const date = new Date(takenAt);

    if (Number.isNaN(date.getTime())) {
      return '撮影日時不明';
    }

    return date.toLocaleString('ja-JP');
  };


  const deletePhoto = async () => {
    if (!photo || deleting) {
      return;
    }

    setDeleting(true);

    try {
      const savedPhotos =
        await AsyncStorage.getItem('photos');

      if (savedPhotos === null) {
        throw new Error('写真データがありません');
      }

      const photos: PhotoRecord[] =
        JSON.parse(savedPhotos);

      const remainingPhotos =
        photos.filter((item) => {
          return item.id !== photo.id;
        });

      if (remainingPhotos.length === photos.length) {
        throw new Error('削除する写真が見つかりません');
      }

      await AsyncStorage.setItem(
        'photos',
        JSON.stringify(remainingPhotos)
      );

      try {
        const photoFile = new File(photo.uri);

        if (photoFile.exists) {
          photoFile.delete();
        }
      } catch (fileError) {
        await AsyncStorage.setItem(
          'photos',
          savedPhotos
        );

        throw fileError;
      }

      router.back();
    } catch (error) {
      console.log('写真削除エラー:', error);

      Alert.alert(
        '削除できませんでした',
        '写真を削除する際にエラーが発生しました。'
      );
    } finally {
      setDeleting(false);
    }
  };


  const confirmDeletePhoto = () => {
    Alert.alert(
      '写真を削除しますか？',
      'この操作は取り消せません。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: deletePhoto,
        },
      ]
    );
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: '写真' }}
      />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator
            size="large"
            color="white"
          />
        </View>
      ) : errorMessage !== '' ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      ) : photo ? (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            contentFit="contain"
            allowDownscaling
            cachePolicy="disk"
            onError={(error) => {
              console.log(
                '画像表示エラー:',
                error.error
              );

              setErrorMessage(
                '画像ファイルを表示できません'
              );
            }}
          />

          <View style={styles.photoInfo}>
            <Text style={styles.subjectText}>
              {getPhotoLabel(photo)}
            </Text>

            <Text style={styles.dateText}>
              {getTakenAtLabel(photo.takenAt)}
            </Text>

            <Pressable
              style={[
                styles.deleteButton,
                deleting && styles.disabledButton,
              ]}
              disabled={deleting}
              onPress={confirmDeletePhoto}
            >
              <Text style={styles.deleteButtonText}>
                {deleting
                  ? '削除中...'
                  : 'この写真を削除'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },

  image: {
    flex: 1,
    width: '100%',
  },

  photoInfo: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#111',
  },

  subjectText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },

  dateText: {
    color: '#bbb',
    fontSize: 14,
    marginTop: 4,
  },

  deleteButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#ff5c5c',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 14,
  },

  disabledButton: {
    opacity: 0.5,
  },

  deleteButtonText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
