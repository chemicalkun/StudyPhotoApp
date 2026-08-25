import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import {
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
});
