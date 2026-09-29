import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
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

import { LoadErrorCard } from '@/components/load-error-card';
import {
  getLectureSummarySourcePhotoIds,
  createLectureSummaryId,
} from '@/types/lecture-summary';
import {
  loadLectureSummaryRecords,
  moveLectureSummaryRecord,
} from '@/services/lecture-summary-storage';
import {
  getPhotoAcademicTerm,
  isUnclassifiedPhoto,
  parsePhotoRecords,
  PhotoRecord,
} from '@/types/photo';
import { formatAcademicTerm } from '@/types/academic-term';
import { parseTimetable } from '@/utils/classification';
import {
  areSameSubjectNames,
  getUniqueTimetableSubjects,
} from '@/utils/timetable-subject';
import type { PhotoOcrRecord } from '@/types/photo-ocr';
import {
  deletePhotoOcrRecord,
  loadPhotoOcrRecord,
  savePhotoOcrRecord,
  updatePhotoOcrText,
} from '@/services/photo-ocr-storage';
import {
  loadPhotoRecords,
  updatePhotoImportance,
  updatePhotoNote,
} from '@/services/photo-storage';
import {
  isStudyPhotoVisionAvailable,
  recognizeText,
} from '@/modules/study-photo-vision';
import { assignPhotoToLecture } from '@/utils/photo-lecture';
import { comparePhotosByLectureOrder } from '@/utils/photo-order';


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
  const isImportantReview =
    params.mode === 'important';
  const importantReviewSubject =
    typeof params.importantSubject === 'string' &&
    params.importantSubject !== ''
      ? params.importantSubject
      : null;

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
  const [savingImportance, setSavingImportance] =
    useState(false);
  const [noteModalVisible, setNoteModalVisible] =
    useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaveError, setNoteSaveError] = useState('');
  const [noteEditorRevision, setNoteEditorRevision] =
    useState(0);
  const [recognizingText, setRecognizingText] =
    useState(false);
  const [photoOcrRecord, setPhotoOcrRecord] =
    useState<PhotoOcrRecord | null>(null);
  const [textRecognitionError, setTextRecognitionError] =
    useState('');
  const [textRecognitionModalVisible, setTextRecognitionModalVisible] =
    useState(false);
  const [isEditingRecognition, setIsEditingRecognition] =
    useState(false);
  const [savingRecognitionEdit, setSavingRecognitionEdit] =
    useState(false);
  const [recognitionEditError, setRecognitionEditError] =
    useState('');
  const [
    classificationModalVisible,
    setClassificationModalVisible,
  ] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [timetableSubjects, setTimetableSubjects] =
    useState<string[]>([]);
  const [classificationLoadError, setClassificationLoadError] =
    useState('');
  const [
    savingClassification,
    setSavingClassification,
  ] = useState(false);
  const [lectureMoveModalVisible, setLectureMoveModalVisible] =
    useState(false);
  const [movingLecture, setMovingLecture] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');
  const [loadFailed, setLoadFailed] =
    useState(false);
  const [loadRevision, setLoadRevision] =
    useState(0);

  const zoomScale = useRef(1);
  const photoNoteRef = useRef('');
  const editedRecognitionTextRef = useRef('');
  const translateX = useRef(
    new Animated.Value(0)
  ).current;


  useEffect(() => {
    const loadPhoto = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        setLoadFailed(false);
        setPhoto(null);
        setLecturePhotos([]);
        setImageLoadFailed(false);
        setPhotoOcrRecord(null);
        setTextRecognitionError('');
        setTextRecognitionModalVisible(false);
        setNoteModalVisible(false);
        setNoteSaveError('');
        setIsEditingRecognition(false);
        setRecognitionEditError('');
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

        const selectedLabel = getPhotoLabel(selectedPhoto);

        const relatedPhotos = isImportantReview
          ? photos
              .filter(
                (item) =>
                  item.isImportant === true &&
                  (
                    importantReviewSubject === null ||
                    getPhotoLabel(item) ===
                      importantReviewSubject
                  )
              )
              .sort(
                (photoA, photoB) =>
                  new Date(photoB.takenAt).getTime() -
                  new Date(photoA.takenAt).getTime()
              )
          : photos
              .filter((item) => {
                return getPhotoLabel(item) === selectedLabel;
              })
              .sort(comparePhotosByLectureOrder);

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
        setLoadFailed(true);
        setErrorMessage(
          '写真の読み込みに失敗しました。データは削除されていません。'
        );
      } finally {
        setLoading(false);
      }
    };

    loadPhoto();
  }, [
    importantReviewSubject,
    isImportantReview,
    loadRevision,
    photoId,
  ]);


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
      setNoteModalVisible(false);
      setNoteSaveError('');
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


  const togglePhotoImportance = async () => {
    if (photo === null || savingImportance) {
      return;
    }

    const nextIsImportant = photo.isImportant !== true;

    try {
      setSavingImportance(true);

      const updatedPhoto = await updatePhotoImportance(
        photo.id,
        nextIsImportant
      );

      setPhoto((currentPhoto) =>
        currentPhoto?.id === updatedPhoto.id
          ? updatedPhoto
          : currentPhoto
      );
      setLecturePhotos((currentPhotos) =>
        currentPhotos.map((currentPhoto) =>
          currentPhoto.id === updatedPhoto.id
            ? updatedPhoto
            : currentPhoto
        )
      );
    } catch (error) {
      console.log('重要マーク保存エラー:', error);
      Alert.alert(
        '重要マークを保存できませんでした',
        '少し待ってからもう一度お試しください。'
      );
    } finally {
      setSavingImportance(false);
    }
  };


  const openPhotoNote = () => {
    if (photo === null) {
      return;
    }

    photoNoteRef.current = photo.note ?? '';
    setNoteSaveError('');
    setNoteEditorRevision(
      (currentRevision) => currentRevision + 1
    );
    setNoteModalVisible(true);
  };


  const savePhotoNote = async () => {
    if (photo === null || savingNote) {
      return;
    }

    try {
      setSavingNote(true);
      setNoteSaveError('');

      const updatedPhoto = await updatePhotoNote(
        photo.id,
        photoNoteRef.current
      );

      setPhoto(updatedPhoto);
      setLecturePhotos((currentPhotos) =>
        currentPhotos.map((currentPhoto) =>
          currentPhoto.id === updatedPhoto.id
            ? updatedPhoto
            : currentPhoto
        )
      );
      setNoteModalVisible(false);
    } catch (error) {
      console.log('写真メモ保存エラー:', error);
      setNoteSaveError(
        'メモを保存できませんでした。もう一度お試しください。'
      );
    } finally {
      setSavingNote(false);
    }
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
    setIsEditingRecognition(false);
    setRecognitionEditError('');
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


  const startEditingRecognition = () => {
    if (currentPhotoOcrRecord === null) {
      return;
    }

    editedRecognitionTextRef.current =
      currentPhotoOcrRecord.text;
    setRecognitionEditError('');
    setIsEditingRecognition(true);
  };


  const saveEditedRecognition = async () => {
    if (
      currentPhotoOcrRecord === null ||
      savingRecognitionEdit
    ) {
      return;
    }

    const editedText =
      editedRecognitionTextRef.current.trim();

    if (editedText === '') {
      setRecognitionEditError(
        '認識結果の文字を入力してください。'
      );
      return;
    }

    try {
      setSavingRecognitionEdit(true);
      setRecognitionEditError('');

      const updatedRecord = await updatePhotoOcrText(
        currentPhotoOcrRecord.photoId,
        editedText
      );

      setPhotoOcrRecord(updatedRecord);
      editedRecognitionTextRef.current =
        updatedRecord.text;
      setIsEditingRecognition(false);
    } catch (error) {
      console.log('OCR結果編集エラー:', error);
      setRecognitionEditError(
        '認識結果を保存できませんでした。もう一度お試しください。'
      );
    } finally {
      setSavingRecognitionEdit(false);
    }
  };


  const shareRecognitionResult = async () => {
    if (
      photo === null ||
      currentPhotoOcrRecord === null
    ) {
      return;
    }

    try {
      await Share.share({
        title: `${getPhotoLabel(photo)} 写真の認識結果`,
        message: [
          getPhotoLabel(photo),
          getTakenAtLabel(
            photo.originalTakenAt ?? photo.takenAt
          ),
          '',
          currentPhotoOcrRecord.text,
        ].join('\n'),
      });
    } catch (error) {
      console.log('OCR結果共有エラー:', error);
      Alert.alert(
        '共有できませんでした',
        '認識結果を共有する際にエラーが発生しました。'
      );
    }
  };


  const openClassificationModal = async () => {
    if (!photo) {
      return;
    }

    setSubjectInput(photo.subject ?? '');
    setTimetableSubjects([]);
    setClassificationLoadError('');
    setClassificationModalVisible(true);

    try {
      const savedTimetable =
        await AsyncStorage.getItem('timetable');
      const timetable = parseTimetable(savedTimetable);

      setTimetableSubjects(
        getUniqueTimetableSubjects(timetable)
      );
    } catch (error) {
      console.log(
        '分類候補読み込みエラー:',
        error
      );
      setClassificationLoadError(
        '時間割の授業候補を読み込めませんでした。授業名は手入力できます。'
      );
    }
  };


  const saveClassification = async (
    selectedSubject = subjectInput
  ) => {
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
        selectedSubject.trim() || null;
      const previousSummarySubject =
        isUnclassifiedPhoto(photo)
          ? '未分類'
          : photo.subject;
      const nextSummarySubject =
        normalizedSubject ?? '未分類';
      const lectureDateKey = getDateKey(photo.takenAt);

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

      const lectureSummaryRecords =
        await loadLectureSummaryRecords();
      const expectedPreviousSummaryId =
        previousSummarySubject === null
          ? null
          : createLectureSummaryId(
              previousSummarySubject,
              lectureDateKey
            );
      const expectedPreviousSummary =
        expectedPreviousSummaryId === null
          ? undefined
          : lectureSummaryRecords[
              expectedPreviousSummaryId
            ];
      const summariesUsingCurrentPhoto = Object.values(
        lectureSummaryRecords
      ).filter((summary) => {
        if (summary.dateKey !== lectureDateKey) {
          return false;
        }

        return getLectureSummarySourcePhotoIds(
          summary.sourceOcrSignature
        )?.includes(photo.id) === true;
      });
      const previousSummary =
        expectedPreviousSummary ??
        (
          summariesUsingCurrentPhoto.length === 1
            ? summariesUsingCurrentPhoto[0]
            : undefined
        );
      const previousSummaryId = previousSummary === undefined
        ? undefined
        : previousSummary.id;
      const summarySourcePhotoIds = previousSummary === undefined
        ? null
        : getLectureSummarySourcePhotoIds(
            previousSummary.sourceOcrSignature
          );
      const updatedPhotosById = new Map(
        updatedPhotos.map((item) => [item.id, item])
      );
      const allSummaryPhotosMoved =
        summarySourcePhotoIds !== null &&
        summarySourcePhotoIds.length > 0 &&
        summarySourcePhotoIds.every((photoId) => {
          const sourcePhoto = updatedPhotosById.get(photoId);

          if (
            sourcePhoto === undefined ||
            getDateKey(sourcePhoto.takenAt) !== lectureDateKey
          ) {
            return false;
          }

          return nextSummarySubject === '未分類'
            ? isUnclassifiedPhoto(sourcePhoto)
            : sourcePhoto.subject !== null &&
                areSameSubjectNames(
                  sourcePhoto.subject,
                  nextSummarySubject
                );
        });
      const shouldMoveSummary =
        previousSummary !== undefined &&
        previousSummaryId !== undefined &&
        !areSameSubjectNames(
          previousSummary.subject,
          nextSummarySubject
        ) &&
        allSummaryPhotosMoved;

      await AsyncStorage.setItem(
        'photos',
        JSON.stringify(updatedPhotos)
      );

      try {
        if (shouldMoveSummary) {
          await moveLectureSummaryRecord(
            previousSummaryId,
            nextSummarySubject
          );
        }
      } catch (summaryMoveError) {
        try {
          await AsyncStorage.setItem(
            'photos',
            savedPhotos
          );
        } catch (rollbackError) {
          console.log(
            '写真分類の復元エラー:',
            rollbackError
          );
        }

        throw summaryMoveError;
      }

      setPhoto(updatedPhoto);
      setClassificationModalVisible(false);

      if (shouldMoveSummary) {
        Alert.alert(
          '分類を変更しました',
          'この授業回のまとめも同じ授業へ移動しました。'
        );
      }
    } catch (error) {
      console.log('写真分類変更エラー:', error);

      Alert.alert(
        '分類を変更できませんでした',
        error instanceof Error &&
        error.message ===
          '移動先に同じ日の授業まとめがあります'
          ? '移動先に同じ日のまとめがあるため、上書きせず中止しました。'
          : '写真の分類を保存する際にエラーが発生しました。'
      );
    } finally {
      setSavingClassification(false);
    }
  };


  const movePhotoToLecture = async (
    targetLectureDateKey: string
  ) => {
    if (!photo || movingLecture) {
      return;
    }

    const targetLecturePhoto = lecturePhotos.find(
      (item) =>
        getDateKey(item.takenAt) === targetLectureDateKey
    );

    if (targetLecturePhoto === undefined) {
      Alert.alert(
        '授業回を変更できませんでした',
        '移動先の授業回が見つかりません。'
      );
      return;
    }

    setMovingLecture(true);

    try {
      const savedPhotos =
        await AsyncStorage.getItem('photos');

      if (savedPhotos === null) {
        throw new Error('写真データがありません');
      }

      const photos = parsePhotoRecords(savedPhotos);
      const movedPhoto = assignPhotoToLecture(
        photo,
        targetLecturePhoto
      );
      let photoFound = false;
      const updatedPhotos = photos.map((item) => {
        if (item.id !== photo.id) {
          return item;
        }

        photoFound = true;
        return movedPhoto;
      });

      if (!photoFound) {
        throw new Error('移動する写真が見つかりません');
      }

      await AsyncStorage.setItem(
        'photos',
        JSON.stringify(updatedPhotos)
      );

      const updatedLecturePhotos = lecturePhotos
        .map((item) =>
          item.id === movedPhoto.id ? movedPhoto : item
        )
        .sort(comparePhotosByLectureOrder);

      setPhoto(movedPhoto);
      setLecturePhotos(updatedLecturePhotos);
      setLectureMoveModalVisible(false);
      translateX.setValue(0);

      Alert.alert(
        '授業回を変更しました',
        'まとめ作成後の回に写真を移動した場合は、対象のまとめが更新必要として扱われます。'
      );
    } catch (error) {
      console.log('授業回変更エラー:', error);
      Alert.alert(
        '授業回を変更できませんでした',
        '写真の移動を保存する際にエラーが発生しました。'
      );
    } finally {
      setMovingLecture(false);
    }
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '写真',
          headerBackTitle: isImportantReview
            ? '復習'
            : '授業',
        }}
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
          {loadFailed ? (
            <LoadErrorCard
              message={errorMessage}
              onRetry={() => {
                setLoadRevision(
                  (revision) => revision + 1
                );
              }}
            />
          ) : (
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          )}
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
              {getTakenAtLabel(
                photo.originalTakenAt ?? photo.takenAt
              )}
            </Text>

            {getPhotoAcademicTerm(photo) !== null ? (
              <Text style={styles.academicTermText}>
                {formatAcademicTerm(
                  getPhotoAcademicTerm(photo)!
                )}
              </Text>
            ) : null}

            {!isImportantReview &&
            currentLectureIndex >= 0 &&
            currentLecturePhotoIndex >= 0 ? (
              <Text style={styles.positionText}>
                第{currentLectureIndex + 1}回 ・ この回の写真{' '}
                {currentLecturePhotoIndex + 1} /{' '}
                {currentLecturePhotos.length}
              </Text>
            ) : null}

            {currentPhotoIndex >= 0 ? (
              <Text style={styles.overallPositionText}>
                {isImportantReview
                  ? '重要な写真'
                  : '授業全体'}{' '}
                {currentPhotoIndex + 1} /{' '}
                {lecturePhotos.length}枚
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.importanceButton,
                photo.isImportant === true &&
                  styles.importanceButtonSelected,
                savingImportance && styles.disabledButton,
              ]}
              disabled={savingImportance}
              accessibilityRole="button"
              accessibilityState={{
                selected: photo.isImportant === true,
              }}
              onPress={() => {
                void togglePhotoImportance();
              }}
            >
              <Text
                style={[
                  styles.importanceButtonText,
                  photo.isImportant === true &&
                    styles.importanceButtonTextSelected,
                ]}
              >
                {savingImportance
                  ? '保存中...'
                  : photo.isImportant === true
                    ? '重要な写真に設定済み'
                    : '重要な写真にする'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.noteButton}
              accessibilityRole="button"
              accessibilityLabel={
                photo.note === undefined
                  ? '写真にメモを追加'
                  : '写真のメモを編集'
              }
              onPress={openPhotoNote}
            >
              <View style={styles.noteButtonHeader}>
                <Text style={styles.noteButtonTitle}>
                  メモ
                </Text>
                <Text style={styles.noteButtonAction}>
                  {photo.note === undefined
                    ? '追加 ›'
                    : '編集 ›'}
                </Text>
              </View>

              <Text
                style={[
                  styles.notePreview,
                  photo.note === undefined &&
                    styles.notePreviewEmpty,
                ]}
                numberOfLines={2}
              >
                {photo.note ??
                  'この写真の補足や、復習したい内容を記録できます'}
              </Text>
            </Pressable>

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
                  setIsEditingRecognition(false);
                  setRecognitionEditError('');
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
              onPress={() => {
                void openClassificationModal();
              }}
            >
              <Text style={styles.classificationButtonText}>
                分類を変更
              </Text>
            </Pressable>

            {!isImportantReview &&
            !isUnclassifiedPhoto(photo) &&
            lectureDateKeys.length > 1 ? (
              <Pressable
                style={styles.lectureMoveButton}
                onPress={() => {
                  setLectureMoveModalVisible(true);
                }}
              >
                <Text style={styles.lectureMoveButtonText}>
                  授業回を変更
                </Text>
              </Pressable>
            ) : null}

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
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingNote) {
            setNoteModalVisible(false);
            setNoteSaveError('');
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              写真のメモ
            </Text>

            <Text style={styles.modalDescription}>
              補足や、あとで確認したい内容を記録できます。
            </Text>

            <TextInput
              key={noteEditorRevision}
              style={styles.noteInput}
              defaultValue={photo?.note ?? ''}
              multiline
              autoCorrect
              editable={!savingNote}
              maxLength={2000}
              placeholder="例：この反応機構は試験前に見直す"
              placeholderTextColor="#888"
              textAlignVertical="top"
              onChangeText={(text) => {
                photoNoteRef.current = text;
              }}
            />

            <Text style={styles.inputHint}>
              空欄で保存するとメモを削除します。
            </Text>

            {noteSaveError !== '' ? (
              <Text style={styles.noteSaveError}>
                {noteSaveError}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.saveButton,
                savingNote && styles.disabledButton,
              ]}
              disabled={savingNote}
              onPress={() => {
                void savePhotoNote();
              }}
            >
              <Text style={styles.saveButtonText}>
                {savingNote ? '保存中...' : '保存'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              disabled={savingNote}
              onPress={() => {
                setNoteModalVisible(false);
                setNoteSaveError('');
              }}
            >
              <Text style={styles.cancelButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={lectureMoveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!movingLecture) {
            setLectureMoveModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.lectureMoveModalContent}>
            <Text style={styles.modalTitle}>
              授業回を変更
            </Text>

            <Text style={styles.modalDescription}>
              この写真を移動する授業回を選んでください。
            </Text>

            <ScrollView style={styles.lectureMoveList}>
              {lectureDateKeys.map((dateKey, index) => {
                const representativePhoto =
                  lecturePhotos.find(
                    (item) =>
                      getDateKey(item.takenAt) === dateKey
                  );
                const isCurrent =
                  dateKey === currentLectureDateKey;
                const lecturePhotoCount =
                  lecturePhotos.filter(
                    (item) =>
                      getDateKey(item.takenAt) === dateKey
                  ).length;

                return (
                  <Pressable
                    key={dateKey}
                    style={[
                      styles.lectureMoveTarget,
                      isCurrent &&
                        styles.lectureMoveTargetCurrent,
                    ]}
                    disabled={isCurrent || movingLecture}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isCurrent }}
                    onPress={() => {
                      void movePhotoToLecture(dateKey);
                    }}
                  >
                    <View>
                      <Text style={styles.lectureMoveTargetTitle}>
                        第{index + 1}回
                      </Text>

                      <Text style={styles.lectureMoveTargetDetail}>
                        {representativePhoto === undefined
                          ? dateKey
                          : new Date(
                              representativePhoto.takenAt
                            ).toLocaleDateString('ja-JP', {
                              month: 'numeric',
                              day: 'numeric',
                            })}
                        ・{lecturePhotoCount}枚
                      </Text>
                    </View>

                    <Text style={styles.lectureMoveTargetStatus}>
                      {isCurrent
                        ? '現在の回'
                        : 'ここへ移動'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {movingLecture ? (
              <View style={styles.lectureMoveProgress}>
                <ActivityIndicator
                  size="small"
                  color="#3478f6"
                />

                <Text style={styles.lectureMoveProgressText}>
                  授業回を変更中...
                </Text>
              </View>
            ) : null}

            <Pressable
              style={styles.cancelButton}
              disabled={movingLecture}
              onPress={() => {
                setLectureMoveModalVisible(false);
              }}
            >
              <Text style={styles.cancelButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
              時間割の授業を選ぶか、授業名を入力してください。
            </Text>

            {timetableSubjects.length > 0 ? (
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.subjectCandidates}
                contentContainerStyle={
                  styles.subjectCandidatesContent
                }
              >
                {timetableSubjects.map((candidate) => (
                  <Pressable
                    key={candidate}
                    style={styles.subjectCandidateButton}
                    disabled={savingClassification}
                    onPress={() => {
                      void saveClassification(candidate);
                    }}
                  >
                    <Text style={styles.subjectCandidateText}>
                      {candidate}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {classificationLoadError !== '' ? (
              <Text style={styles.classificationLoadError}>
                {classificationLoadError}
              </Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={subjectInput}
              onChangeText={setSubjectInput}
              placeholder="例：高分子化学"
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
              onPress={() => {
                void saveClassification();
              }}
            >
              <Text style={styles.saveButtonText}>
                {savingClassification
                  ? '保存中...'
                  : '保存'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.unclassifiedButton}
              disabled={savingClassification}
              onPress={() => {
                void saveClassification('');
              }}
            >
              <Text style={styles.unclassifiedButtonText}>
                未分類にする
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
          if (
            !recognizingText &&
            !savingRecognitionEdit
          ) {
            setIsEditingRecognition(false);
            setRecognitionEditError('');
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
            ) : currentPhotoOcrRecord !== null &&
              isEditingRecognition ? (
              <View style={styles.recognitionEditContainer}>
                <Text style={styles.recognitionEditDescription}>
                  修正した文字は検索や次回のまとめ作成に使われます。
                </Text>

                <TextInput
                  style={styles.recognitionEditInput}
                  defaultValue={editedRecognitionTextRef.current}
                  multiline
                  autoCorrect
                  editable={!savingRecognitionEdit}
                  textAlignVertical="top"
                  onChangeText={(text) => {
                    editedRecognitionTextRef.current = text;
                  }}
                />

                {recognitionEditError !== '' ? (
                  <Text style={styles.recognitionErrorText}>
                    {recognitionEditError}
                  </Text>
                ) : null}

                <View style={styles.recognitionEditActions}>
                  <Pressable
                    style={styles.recognitionEditCancelButton}
                    disabled={savingRecognitionEdit}
                    onPress={() => {
                      setIsEditingRecognition(false);
                      setRecognitionEditError('');
                    }}
                  >
                    <Text style={styles.recognitionEditCancelText}>
                      キャンセル
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.recognitionEditSaveButton,
                      savingRecognitionEdit &&
                        styles.disabledButton,
                    ]}
                    disabled={savingRecognitionEdit}
                    onPress={() => {
                      void saveEditedRecognition();
                    }}
                  >
                    {savingRecognitionEdit ? (
                      <ActivityIndicator
                        size="small"
                        color="white"
                      />
                    ) : null}

                    <Text style={styles.recognitionEditSaveText}>
                      {savingRecognitionEdit
                        ? '保存中...'
                        : '保存'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : currentPhotoOcrRecord !== null ? (
              <>
                <ScrollView
                  style={styles.recognitionResults}
                  contentContainerStyle={
                    styles.recognitionResultsContent
                  }
                >
                  <Text style={styles.recognitionCountText}>
                    {currentPhotoOcrRecord.manuallyEdited
                      ? '認識結果を手動修正済み'
                      : `${currentPhotoOcrRecord.blocks.length}件の文字領域を認識しました`}
                  </Text>

                  <Text style={styles.recognizedAtText}>
                    最終更新：
                    {getTakenAtLabel(
                      currentPhotoOcrRecord.recognizedAt
                    )}
                  </Text>

                  {currentPhotoOcrRecord.manuallyEdited ? (
                    <View style={styles.recognitionResultRow}>
                      <Text
                        style={styles.recognitionResultText}
                        selectable
                      >
                        {currentPhotoOcrRecord.text}
                      </Text>
                    </View>
                  ) : (
                    currentPhotoOcrRecord.blocks.map((block, index) => (
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
                    ))
                  )}
                </ScrollView>

                <View style={styles.recognitionResultActions}>
                  <Pressable
                    style={styles.editRecognitionButton}
                    accessibilityRole="button"
                    onPress={startEditingRecognition}
                  >
                    <Text style={styles.editRecognitionButtonText}>
                      認識結果を編集
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.shareRecognitionButton}
                    accessibilityRole="button"
                    onPress={() => {
                      void shareRecognitionResult();
                    }}
                  >
                    <Text style={styles.shareRecognitionButtonText}>
                      認識結果を共有
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {!isEditingRecognition ? (
              <Pressable
                style={styles.cancelButton}
                disabled={recognizingText}
                onPress={() => {
                  setRecognitionEditError('');
                  setTextRecognitionModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>
                  閉じる
                </Text>
              </Pressable>
            ) : null}
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

  academicTermText: {
    color: '#9db5e8',
    fontSize: 13,
    fontWeight: 'bold',
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

  importanceButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#8b8b8b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },

  importanceButtonSelected: {
    backgroundColor: '#5a4617',
    borderColor: '#d6a83d',
  },

  importanceButtonText: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: 'bold',
  },

  importanceButtonTextSelected: {
    color: '#ffdc81',
  },

  noteButton: {
    borderWidth: 1,
    borderColor: '#686868',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },

  noteButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  noteButtonTitle: {
    color: '#eee',
    fontSize: 13,
    fontWeight: 'bold',
  },

  noteButtonAction: {
    color: '#9db5e8',
    fontSize: 13,
    fontWeight: 'bold',
  },

  notePreview: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },

  notePreviewEmpty: {
    color: '#888',
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

  lectureMoveButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#8ba8e5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 10,
  },

  lectureMoveButtonText: {
    color: '#a9c0f0',
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

  noteInput: {
    minHeight: 140,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    color: '#111',
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 16,
  },

  noteSaveError: {
    color: '#9b2c2c',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },

  lectureMoveModalContent: {
    maxHeight: '78%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 22,
  },

  lectureMoveList: {
    flexShrink: 1,
    marginTop: 16,
  },

  lectureMoveTarget: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },

  lectureMoveTargetCurrent: {
    backgroundColor: '#eee',
    borderColor: '#ccc',
  },

  lectureMoveTargetTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: 'bold',
  },

  lectureMoveTargetDetail: {
    color: '#666',
    fontSize: 12,
    marginTop: 3,
  },

  lectureMoveTargetStatus: {
    color: '#31518f',
    fontSize: 12,
    fontWeight: 'bold',
  },

  lectureMoveProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },

  lectureMoveProgressText: {
    color: '#555',
    fontSize: 13,
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

  recognitionResultActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  editRecognitionButton: {
    flex: 1,
    backgroundColor: '#eef3ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },

  editRecognitionButtonText: {
    color: '#31518f',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  shareRecognitionButton: {
    flex: 1,
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },

  shareRecognitionButtonText: {
    color: '#28794c',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  recognitionEditContainer: {
    flexShrink: 1,
    marginTop: 14,
  },

  recognitionEditDescription: {
    color: '#555',
    fontSize: 12,
    lineHeight: 18,
  },

  recognitionEditInput: {
    minHeight: 220,
    maxHeight: 360,
    color: '#111',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 9,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 10,
  },

  recognitionEditActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },

  recognitionEditCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  recognitionEditCancelText: {
    color: '#444',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  recognitionEditSaveButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#31518f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  recognitionEditSaveText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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

  subjectCandidates: {
    marginTop: 16,
    marginHorizontal: -4,
  },

  subjectCandidatesContent: {
    gap: 8,
    paddingHorizontal: 4,
  },

  subjectCandidateButton: {
    backgroundColor: '#e9f0ff',
    borderWidth: 1,
    borderColor: '#9eb8ef',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  subjectCandidateText: {
    color: '#2454a6',
    fontSize: 14,
    fontWeight: 'bold',
  },

  classificationLoadError: {
    color: '#9b2c2c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
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

  unclassifiedButton: {
    borderWidth: 1,
    borderColor: '#9b2c2c',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  unclassifiedButtonText: {
    color: '#9b2c2c',
    fontSize: 14,
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
