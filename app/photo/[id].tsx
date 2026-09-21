import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

import {
  parsePhotoRecords,
  PhotoRecord,
} from '@/types/photo';
import type { PhotoOcrRecord } from '@/types/photo-ocr';
import {
  deletePhotoOcrRecord,
  loadPhotoOcrRecord,
  savePhotoOcrRecord,
} from '@/services/photo-ocr-storage';
import { loadPhotoRecords } from '@/services/photo-storage';
import {
  isStudyPhotoVisionAvailable,
  recognizeText,
} from '@/modules/study-photo-vision';


const swipeDistance = 60;


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


const getDateKey = (takenAt: string) => {
  const date = new Date(takenAt);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${month}-${day}`;
};


export default function PhotoScreen() {
  const params = useLocalSearchParams();
  const { width: screenWidth } =
    useWindowDimensions();

  const photoId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [photo, setPhoto] =
    useState<PhotoRecord | null>(null);
  const [lecturePhotos, setLecturePhotos] =
    useState<PhotoRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] =
    useState(false);
  const [imageLoadFailed, setImageLoadFailed] =
    useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recognizingText, setRecognizingText] =
    useState(false);
  const [photoOcrRecord, setPhotoOcrRecord] =
    useState<PhotoOcrRecord | null>(null);
  const [textRecognitionError, setTextRecognitionError] =
    useState('');
  const [textRecognitionModalVisible, setTextRecognitionModalVisible] =
    useState(false);
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

  const zoomScale = useRef(1);
  const translateX = useRef(
    new Animated.Value(0)
  ).current;


  useEffect(() => {
    const loadPhoto = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        setPhoto(null);
        setImageLoadFailed(false);
        setPhotoOcrRecord(null);
        setTextRecognitionError('');
        setTextRecognitionModalVisible(false);
        zoomScale.current = 1;

        const photos = await loadPhotoRecords();

        if (photos.length === 0) {
          setErrorMessage('写真データがありません');
          return;
        }

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

        try {
          const savedOcrRecord =
            await loadPhotoOcrRecord(selectedPhoto.id);

          setPhotoOcrRecord(savedOcrRecord);
        } catch (ocrError) {
          console.log(
            '保存済みOCR結果読み込みエラー:',
            ocrError
          );
        }
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


  const lectureDateKeys = [
    ...new Set(
      lecturePhotos.map((item) => {
        return getDateKey(item.takenAt);
      })
    ),
  ];

  const currentLectureDateKey = photo
    ? getDateKey(photo.takenAt)
    : '';

  const currentLectureIndex =
    lectureDateKeys.indexOf(currentLectureDateKey);

  const currentLecturePhotos =
    lecturePhotos.filter((item) => {
      return (
        getDateKey(item.takenAt) ===
        currentLectureDateKey
      );
    });

  const currentLecturePhotoIndex = photo
    ? currentLecturePhotos.findIndex((item) => {
        return item.id === photo.id;
      })
    : -1;


  const goToPhoto = (targetIndex: number) => {
    const targetPhoto = lecturePhotos[targetIndex];

    if (!targetPhoto || transitioning) {
      return;
    }

    const exitDirection =
      targetIndex > currentPhotoIndex ? -1 : 1;

    setTransitioning(true);

    Animated.timing(translateX, {
      toValue: exitDirection * screenWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setTransitioning(false);
        return;
      }

      setPhoto(targetPhoto);
      setImageLoadFailed(false);
      setPhotoOcrRecord(null);
      setTextRecognitionError('');
      setTextRecognitionModalVisible(false);
      zoomScale.current = 1;

      loadPhotoOcrRecord(targetPhoto.id)
        .then(setPhotoOcrRecord)
        .catch((error) => {
          console.log(
            '保存済みOCR結果読み込みエラー:',
            error
          );
        });

      translateX.setValue(
        -exitDirection * screenWidth
      );

      Animated.timing(translateX, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setTransitioning(false);
      });
    });
  };


  const resetSwipePosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      speed: 20,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };


  const swipeResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (
      _,
      gestureState
    ) => {
      const horizontalDistance =
        Math.abs(gestureState.dx);

      const verticalDistance =
        Math.abs(gestureState.dy);

      return (
        !transitioning &&
        gestureState.numberActiveTouches === 1 &&
        zoomScale.current <= 1.01 &&
        horizontalDistance > 10 &&
        horizontalDistance > verticalDistance
      );
    },
    onPanResponderMove: (_, gestureState) => {
      if (
        !transitioning &&
        zoomScale.current <= 1.01
      ) {
        translateX.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (zoomScale.current > 1.01) {
        resetSwipePosition();
        return;
      }

      if (
        gestureState.dx <= -swipeDistance &&
        currentPhotoIndex < lecturePhotos.length - 1
      ) {
        goToPhoto(currentPhotoIndex + 1);
        return;
      }

      if (
        gestureState.dx >= swipeDistance &&
        currentPhotoIndex > 0
      ) {
        goToPhoto(currentPhotoIndex - 1);
        return;
      }

      resetSwipePosition();
    },
    onPanResponderTerminate: resetSwipePosition,
  });


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

      const photos = parsePhotoRecords(savedPhotos);

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

      try {
        await deletePhotoOcrRecord(photo.id);
      } catch (ocrError) {
        console.log('OCR結果削除エラー:', ocrError);
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


  const recognizePhotoText = async () => {
    if (!photo || recognizingText) {
      return;
    }

    if (!isStudyPhotoVisionAvailable) {
      Alert.alert(
        '開発ビルドが必要です',
        '写真の文字認識はApple Visionを組み込んだ開発ビルドで利用できます。'
      );
      return;
    }

    setRecognizingText(true);
    setTextRecognitionError('');
    setTextRecognitionModalVisible(true);

    try {
      const recognizedBlocks = await recognizeText(photo.uri);

      if (recognizedBlocks.length === 0) {
        setTextRecognitionError(
          '写真から文字を見つけられませんでした。'
        );
        return;
      }

      const savedOcrRecord = await savePhotoOcrRecord(
        photo.id,
        recognizedBlocks
      );

      setPhotoOcrRecord(savedOcrRecord);
    } catch (error) {
      console.log('授業写真文字認識エラー:', error);

      setTextRecognitionError(
        '写真の文字を認識できませんでした。もう一度お試しください。'
      );
    } finally {
      setRecognizingText(false);
    }
  };


  const currentPhotoOcrRecord =
    photo !== null && photoOcrRecord?.photoId === photo.id
      ? photoOcrRecord
      : null;


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

      const photos = parsePhotoRecords(savedPhotos);

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
          <Animated.View
            style={[
              styles.imageContainer,
              {
                transform: [{ translateX }],
              },
            ]}
            {...swipeResponder.panHandlers}
          >
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
              <ScrollView
                key={photo.id}
                style={styles.zoomContainer}
                contentContainerStyle={styles.zoomContent}
                minimumZoomScale={1}
                maximumZoomScale={4}
                centerContent
                bouncesZoom
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(event) => {
                  zoomScale.current =
                    event.nativeEvent.zoomScale ?? 1;
                }}
              >
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
              </ScrollView>
            )}
          </Animated.View>

          <View style={styles.photoInfo}>
            <Text style={styles.subjectText}>
              {getPhotoLabel(photo)}
            </Text>

            <Text style={styles.dateText}>
              {getTakenAtLabel(photo.takenAt)}
            </Text>

            {currentLectureIndex >= 0 &&
            currentLecturePhotoIndex >= 0 ? (
              <Text style={styles.positionText}>
                第{currentLectureIndex + 1}回 ・ この回の写真{' '}
                {currentLecturePhotoIndex + 1} /{' '}
                {currentLecturePhotos.length}
              </Text>
            ) : null}

            {currentPhotoIndex >= 0 ? (
              <Text style={styles.overallPositionText}>
                授業全体 {currentPhotoIndex + 1} /{' '}
                {lecturePhotos.length}枚
              </Text>
            ) : null}

            {lecturePhotos.length > 1 ? (
              <>
                <Text style={styles.swipeHint}>
                  左右スワイプで移動・ピンチ操作で拡大
                </Text>

                <View style={styles.navigationRow}>
                  <Pressable
                    style={[
                      styles.navigationButton,
                      (currentPhotoIndex <= 0 ||
                        transitioning) &&
                        styles.disabledButton,
                    ]}
                    disabled={
                      currentPhotoIndex <= 0 ||
                      transitioning
                    }
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
                      (currentPhotoIndex >=
                        lecturePhotos.length - 1 ||
                        transitioning) &&
                        styles.disabledButton,
                    ]}
                    disabled={
                      currentPhotoIndex >=
                        lecturePhotos.length - 1 ||
                      transitioning
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
              </>
            ) : null}

            <Pressable
              style={[
                styles.textRecognitionButton,
                (recognizingText || imageLoadFailed) &&
                  styles.disabledButton,
              ]}
              disabled={recognizingText || imageLoadFailed}
              onPress={recognizePhotoText}
            >
              {recognizingText ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.textRecognitionButtonText}>
                  {currentPhotoOcrRecord === null
                    ? '写真の文字を認識'
                    : '文字認識をやり直す'}
                </Text>
              )}
            </Pressable>

            {currentPhotoOcrRecord !== null ? (
              <Pressable
                style={styles.showRecognitionButton}
                disabled={recognizingText}
                onPress={() => {
                  setTextRecognitionError('');
                  setTextRecognitionModalVisible(true);
                }}
              >
                <Text style={styles.showRecognitionButtonText}>
                  保存済みの認識結果を見る
                </Text>
              </Pressable>
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

      <Modal
        visible={textRecognitionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!recognizingText) {
            setTextRecognitionModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.textRecognitionModalContent}>
            <Text style={styles.modalTitle}>
              写真から認識した文字
            </Text>

            <Text style={styles.recognitionPrivacyText}>
              端末内で処理し、この写真の認識結果として端末内に保存します。
            </Text>

            {recognizingText ? (
              <View style={styles.recognitionLoading}>
                <ActivityIndicator
                  size="large"
                  color="#3478f6"
                />

                <Text style={styles.recognitionLoadingText}>
                  文字を認識しています...
                </Text>
              </View>
            ) : textRecognitionError !== '' ? (
              <Text style={styles.recognitionErrorText}>
                {textRecognitionError}
              </Text>
            ) : currentPhotoOcrRecord !== null ? (
              <ScrollView
                style={styles.recognitionResults}
                contentContainerStyle={
                  styles.recognitionResultsContent
                }
              >
                <Text style={styles.recognitionCountText}>
                  {currentPhotoOcrRecord.blocks.length}件の文字領域を認識しました
                </Text>

                <Text style={styles.recognizedAtText}>
                  認識日時：
                  {getTakenAtLabel(
                    currentPhotoOcrRecord.recognizedAt
                  )}
                </Text>

                {currentPhotoOcrRecord.blocks.map((block, index) => (
                  <View
                    style={styles.recognitionResultRow}
                    key={`${block.text}-${index}`}
                  >
                    <Text
                      style={styles.recognitionResultText}
                      selectable
                    >
                      {block.text}
                    </Text>

                    <Text style={styles.recognitionConfidenceText}>
                      OCR参考値{' '}
                      {Math.round(block.confidence * 100)}%
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Pressable
              style={styles.cancelButton}
              disabled={recognizingText}
              onPress={() =>
                setTextRecognitionModalVisible(false)
              }
            >
              <Text style={styles.cancelButtonText}>
                閉じる
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

  imageContainer: {
    flex: 1,
    width: '100%',
  },

  zoomContainer: {
    flex: 1,
  },

  zoomContent: {
    flexGrow: 1,
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

  overallPositionText: {
    color: '#777',
    fontSize: 12,
    marginTop: 3,
  },

  swipeHint: {
    color: '#888',
    fontSize: 12,
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

  textRecognitionButton: {
    alignSelf: 'flex-start',
    minWidth: 150,
    minHeight: 40,
    backgroundColor: '#28794c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 14,
  },

  textRecognitionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  showRecognitionButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#63a17b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },

  showRecognitionButtonText: {
    color: '#9dd6b1',
    fontSize: 13,
    fontWeight: 'bold',
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

  textRecognitionModalContent: {
    maxHeight: '82%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 22,
  },

  recognitionPrivacyText: {
    color: '#555',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  recognitionLoading: {
    alignItems: 'center',
    paddingVertical: 36,
  },

  recognitionLoadingText: {
    color: '#555',
    fontSize: 14,
    marginTop: 12,
  },

  recognitionErrorText: {
    color: '#a13333',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 20,
    marginBottom: 8,
  },

  recognitionResults: {
    marginTop: 14,
  },

  recognitionResultsContent: {
    paddingBottom: 8,
  },

  recognitionCountText: {
    color: '#555',
    fontSize: 13,
    marginBottom: 6,
  },

  recognizedAtText: {
    color: '#777',
    fontSize: 11,
    marginBottom: 8,
  },

  recognitionResultRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 10,
  },

  recognitionResultText: {
    color: '#222',
    fontSize: 15,
    lineHeight: 22,
  },

  recognitionConfidenceText: {
    color: '#777',
    fontSize: 11,
    marginTop: 3,
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
