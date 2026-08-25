import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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


export default function PhotoScreen() {
  const params = useLocalSearchParams();

  const photoId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [photo, setPhoto] =
    useState<PhotoRecord | null>(null);
  const [lecturePhotos, setLecturePhotos] =
    useState<PhotoRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [imageLoadFailed, setImageLoadFailed] =
    useState(false);
  const [deleting, setDeleting] = useState(false);
  const [
    classificationModalVisible,
    setClassificationModalVisible,
  ] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [
    savingClassification,
    setSavingClassification,
  ] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');


  useEffect(() => {
    const loadPhoto = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        setPhoto(null);
        setImageLoadFailed(false);

        const savedPhotos =
          await AsyncStorage.getItem('photos');

        if (savedPhotos === null) {
          setErrorMessage('写真データがありません');
          return;
        }

        const parsedPhotos: unknown =
          JSON.parse(savedPhotos);

        if (!Array.isArray(parsedPhotos)) {
          throw new Error(
            'photosが配列ではありません'
          );
        }

        const photos = parsedPhotos as PhotoRecord[];

        const selectedPhoto =
          photos.find((item) => {
            return item.id === photoId;
          });

        if (!selectedPhoto) {
          setErrorMessage('写真が見つかりません');
          return;
        }

        const selectedLabel =
          getPhotoLabel(selectedPhoto);

        const relatedPhotos = photos
          .filter((item) => {
            return getPhotoLabel(item) === selectedLabel;
          })
          .sort((a, b) => {
            const dateA =
              new Date(a.takenAt).getTime();

            const dateB =
              new Date(b.takenAt).getTime();

            return dateA - dateB;
          });

        setLecturePhotos(relatedPhotos);
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


  const getTakenAtLabel = (takenAt: string) => {
    const date = new Date(takenAt);

    if (Number.isNaN(date.getTime())) {
      return '撮影日時不明';
    }

    return date.toLocaleString('ja-JP');
  };


  const currentPhotoIndex = photo
    ? lecturePhotos.findIndex((item) => {
        return item.id === photo.id;
      })
    : -1;


  const goToPhoto = (targetIndex: number) => {
    const targetPhoto = lecturePhotos[targetIndex];

    if (!targetPhoto) {
      return;
    }

    router.replace({
      pathname: '/photo/[id]',
      params: { id: targetPhoto.id },
    });
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


  const openClassificationModal = () => {
    if (!photo) {
      return;
    }

    setSubjectInput(photo.subject ?? '');
    setClassificationModalVisible(true);
  };


  const saveClassification = async () => {
    if (!photo || savingClassification) {
      return;
    }

    setSavingClassification(true);

    try {
      const savedPhotos =
        await AsyncStorage.getItem('photos');

      if (savedPhotos === null) {
        throw new Error('写真データがありません');
      }

      const photos: PhotoRecord[] =
        JSON.parse(savedPhotos);

      const normalizedSubject =
        subjectInput.trim() || null;

      let updatedPhoto: PhotoRecord | null = null;

      const updatedPhotos = photos.map((item) => {
        if (item.id !== photo.id) {
          return item;
        }

        updatedPhoto = {
          ...item,
          subject: normalizedSubject,
        };

        return updatedPhoto;
      });

      if (updatedPhoto === null) {
        throw new Error('分類を変更する写真が見つかりません');
      }

      await AsyncStorage.setItem(
        'photos',
        JSON.stringify(updatedPhotos)
      );

      setPhoto(updatedPhoto);
      setClassificationModalVisible(false);
    } catch (error) {
      console.log('写真分類変更エラー:', error);

      Alert.alert(
        '分類を変更できませんでした',
        '写真の分類を保存する際にエラーが発生しました。'
      );
    } finally {
      setSavingClassification(false);
    }
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
          {imageLoadFailed ? (
            <View style={styles.imageErrorContainer}>
              <Text style={styles.errorText}>
                画像ファイルを表示できません
              </Text>

              <Text style={styles.imageErrorHint}>
                写真データの分類変更や削除は引き続き行えます。
              </Text>
            </View>
          ) : (
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

                setImageLoadFailed(true);
              }}
            />
          )}

          <View style={styles.photoInfo}>
            <Text style={styles.subjectText}>
              {getPhotoLabel(photo)}
            </Text>

            <Text style={styles.dateText}>
              {getTakenAtLabel(photo.takenAt)}
            </Text>

            {currentPhotoIndex >= 0 ? (
              <Text style={styles.positionText}>
                写真 {currentPhotoIndex + 1} /{' '}
                {lecturePhotos.length}
              </Text>
            ) : null}

            {lecturePhotos.length > 1 ? (
              <View style={styles.navigationRow}>
                <Pressable
                  style={[
                    styles.navigationButton,
                    currentPhotoIndex <= 0 &&
                      styles.disabledButton,
                  ]}
                  disabled={currentPhotoIndex <= 0}
                  onPress={() =>
                    goToPhoto(currentPhotoIndex - 1)
                  }
                >
                  <Text style={styles.navigationButtonText}>
                    ‹ 前の写真
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.navigationButton,
                    currentPhotoIndex >=
                      lecturePhotos.length - 1 &&
                      styles.disabledButton,
                  ]}
                  disabled={
                    currentPhotoIndex >=
                    lecturePhotos.length - 1
                  }
                  onPress={() =>
                    goToPhoto(currentPhotoIndex + 1)
                  }
                >
                  <Text style={styles.navigationButtonText}>
                    次の写真 ›
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              style={styles.classificationButton}
              onPress={openClassificationModal}
            >
              <Text style={styles.classificationButtonText}>
                分類を変更
              </Text>
            </Pressable>

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

      <Modal
        visible={classificationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setClassificationModalVisible(false)
        }
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              分類を変更
            </Text>

            <Text style={styles.modalDescription}>
              授業名を入力してください。
            </Text>

            <TextInput
              style={styles.input}
              value={subjectInput}
              onChangeText={setSubjectInput}
              placeholder="例：高分子化学"
              autoFocus
            />

            <Text style={styles.inputHint}>
              空欄で保存すると、曜日・時限による自動分類に戻ります。
            </Text>

            <Pressable
              style={[
                styles.saveButton,
                savingClassification &&
                  styles.disabledButton,
              ]}
              disabled={savingClassification}
              onPress={saveClassification}
            >
              <Text style={styles.saveButtonText}>
                {savingClassification
                  ? '保存中...'
                  : '保存'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              disabled={savingClassification}
              onPress={() =>
                setClassificationModalVisible(false)
              }
            >
              <Text style={styles.cancelButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  imageErrorHint: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
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

  positionText: {
    color: '#888',
    fontSize: 13,
    marginTop: 6,
  },

  navigationRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  navigationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  navigationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  classificationButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3478f6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 14,
  },

  classificationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  deleteButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#ff5c5c',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  deleteButtonText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: 'bold',
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },

  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 22,
  },

  modalTitle: {
    color: 'black',
    fontSize: 22,
    fontWeight: 'bold',
  },

  modalDescription: {
    color: '#444',
    fontSize: 15,
    marginTop: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: 'black',
    fontSize: 16,
    marginTop: 18,
  },

  inputHint: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  saveButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 13,
    marginTop: 20,
  },

  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  cancelButton: {
    padding: 12,
    marginTop: 4,
  },

  cancelButtonText: {
    color: 'black',
    fontSize: 15,
    textAlign: 'center',
  },
});
