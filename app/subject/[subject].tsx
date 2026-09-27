import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { HeaderBackButton } from '@react-navigation/elements';

import { LoadErrorCard } from '@/components/load-error-card';
import {
  LectureSummaryReviewPoints,
} from '@/components/lecture-summary-review-points';
import {
  isUnclassifiedPhoto,
  PhotoRecord,
} from '@/types/photo';
import type {
  PhotoOcrRecord,
  PhotoOcrRecords,
} from '@/types/photo-ocr';
import {
  deletePhotoOcrRecord,
  loadPhotoOcrRecords,
  savePhotoOcrRecord,
} from '@/services/photo-ocr-storage';
import {
  loadPhotoRecords,
  savePhotoFromUri,
  savePhotoRecords,
} from '@/services/photo-storage';
import {
  isStudyPhotoVisionAvailable,
  recognizeText,
} from '@/modules/study-photo-vision';
import {
  answerLectureQuestion,
  getLectureSummaryAvailability,
  summarizeLecture,
} from '@/modules/study-photo-intelligence';
import type {
  LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import {
  loadLectureSummaryRecords,
  saveLectureSummaryRecord,
} from '@/services/lecture-summary-storage';
import {
  createLectureSummaryId,
  createLectureSummarySourceSignature,
} from '@/types/lecture-summary';
import type {
  LectureSummaryRecords,
} from '@/types/lecture-summary';
import { parseTimetable } from '@/utils/classification';
import { getUniqueTimetableSubjects } from '@/utils/timetable-subject';
import {
  moveSelectedPhotosToLecture,
  removeSelectedPhotos,
  updateSelectedPhotoSubjects,
} from '@/utils/photo-bulk-actions';
import {
  applyLecturePhotoOrder,
  comparePhotosByLectureOrder,
} from '@/utils/photo-order';


type LectureGroup = {
  dateKey: string;
  dateLabel: string;
  photos: PhotoRecord[];
};


type PhotoRow = {
  id: string;
  photos: PhotoRecord[];
};


type LectureSection = LectureGroup & {
  title: string;
  data: PhotoRow[];
  ocrItems: LectureOcrItem[];
};


type LectureOcrItem = {
  photoNumber: number;
  record: PhotoOcrRecord;
};


type LecturePhotoImportFeedback = {
  message: string;
  isError: boolean;
};


type BulkOperation =
  | 'ocr'
  | 'classification'
  | 'lecture'
  | 'delete';


const getLectureOcrItems = (
  photos: PhotoRecord[],
  records: PhotoOcrRecords
) =>
  photos.flatMap((photo, photoIndex) => {
    const record = records[photo.id];

    return record === undefined
      ? []
      : [{
          photoNumber: photoIndex + 1,
          record,
        }];
  });


const getPhotoLabel = (photo: PhotoRecord) => {
  if (photo.subject) {
    return photo.subject;
  }

  if (
    photo.period !== null &&
    photo.day !== ''
  ) {
    return `${photo.day}曜${photo.period}限`;
  }

  return '未分類';
};


const getDateKeyFromDate = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${month}-${day}`;
};


const getDateKey = (photo: PhotoRecord) =>
  getDateKeyFromDate(new Date(photo.takenAt));


const getDateLabel = (photo: PhotoRecord) => {
  const date = new Date(photo.takenAt);

  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${month}/${day}`;
};


export default function SubjectScreen() {
  const params = useLocalSearchParams();

  const subject =
    typeof params.subject === 'string'
      ? params.subject
      : '';
  const openedFromReview = params.from === 'review';

  const isUnclassified = subject === '未分類';

  const [lectureGroups, setLectureGroups] =
    useState<LectureGroup[]>([]);

  const [status, setStatus] =
    useState('読み込み中...');
  const [loadError, setLoadError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);

  const [failedPhotoIds, setFailedPhotoIds] =
    useState<Record<string, boolean>>({});
  const [photoOcrRecords, setPhotoOcrRecords] =
    useState<PhotoOcrRecords>({});
  const [ocrLoadError, setOcrLoadError] = useState('');
  const [selectedLectureSection, setSelectedLectureSection] =
    useState<LectureSection | null>(null);
  const [summaryAvailability, setSummaryAvailability] =
    useState<LectureSummaryAvailability | null>(null);
  const [lectureSummary, setLectureSummary] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] =
    useState(false);
  const [lectureSummaryRecords, setLectureSummaryRecords] =
    useState<LectureSummaryRecords>({});
  const [summaryLoadError, setSummaryLoadError] =
    useState('');
  const [summarySaveError, setSummarySaveError] =
    useState('');
  const [isLectureSummarySaved, setIsLectureSummarySaved] =
    useState(false);
  const [lectureQuestion, setLectureQuestion] = useState('');
  const [lectureAnswer, setLectureAnswer] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [isAnsweringQuestion, setIsAnsweringQuestion] =
    useState(false);
  const [processingLectureDateKey, setProcessingLectureDateKey] =
    useState<string | null>(null);
  const [lectureProcessingStatus, setLectureProcessingStatus] =
    useState('');
  const [lectureProcessingWarning, setLectureProcessingWarning] =
    useState('');
  const [importingLectureNumber, setImportingLectureNumber] =
    useState<number | null>(null);
  const [isLecturePhotoTargetVisible, setIsLecturePhotoTargetVisible] =
    useState(false);
  const [lecturePhotoImportFeedback, setLecturePhotoImportFeedback] =
    useState<LecturePhotoImportFeedback | null>(null);
  const [photoLibrarySettingsRequired, setPhotoLibrarySettingsRequired] =
    useState(false);
  const [isSelectingPhotos, setIsSelectingPhotos] =
    useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] =
    useState<Set<string>>(new Set());
  const [bulkOperation, setBulkOperation] =
    useState<BulkOperation | null>(null);
  const [bulkLectureModalVisible, setBulkLectureModalVisible] =
    useState(false);
  const [bulkClassificationModalVisible, setBulkClassificationModalVisible] =
    useState(false);
  const [bulkSubjectInput, setBulkSubjectInput] = useState('');
  const [bulkTimetableSubjects, setBulkTimetableSubjects] =
    useState<string[]>([]);
  const [bulkClassificationLoadError, setBulkClassificationLoadError] =
    useState('');
  const [reorderingLectureSection, setReorderingLectureSection] =
    useState<LectureSection | null>(null);
  const [reorderedPhotoIds, setReorderedPhotoIds] =
    useState<string[]>([]);
  const [savingPhotoOrder, setSavingPhotoOrder] =
    useState(false);


  useFocusEffect(
    useCallback(() => {
      // Incrementing this value retries the focus-time load.
      void loadRevision;
      let active = true;

      const loadPhotos = async () => {
        try {
          setStatus('読み込み中...');
          setLoadError('');
          setFailedPhotoIds({});
          setPhotoOcrRecords({});
          setOcrLoadError('');
          setLectureSummaryRecords({});
          setSummaryLoadError('');
          setSelectedLectureSection(null);

          const [
            photoResult,
            ocrResult,
            summaryResult,
          ] = await Promise.allSettled([
            loadPhotoRecords(),
            loadPhotoOcrRecords(),
            loadLectureSummaryRecords(),
          ]);

          if (!active) {
            return;
          }

          if (ocrResult.status === 'fulfilled') {
            setPhotoOcrRecords(ocrResult.value);
          } else {
            console.log(
              '授業回OCR結果読み込みエラー:',
              ocrResult.reason
            );
            setOcrLoadError(
              '保存済みの文字認識結果を読み込めませんでした。'
            );
          }

          if (summaryResult.status === 'fulfilled') {
            setLectureSummaryRecords(
              summaryResult.value
            );
          } else {
            console.log(
              '授業まとめ読み込みエラー:',
              summaryResult.reason
            );
            setSummaryLoadError(
              '保存済みの授業まとめを読み込めませんでした。'
            );
          }

          if (photoResult.status === 'rejected') {
            console.log(
              '授業写真読み込みエラー:',
              photoResult.reason
            );
            setLectureGroups([]);
            setStatus('');
            setLoadError(
              '授業写真を読み込めませんでした。データは削除されていません。'
            );
            return;
          }

          const allPhotos = photoResult.value;

          if (allPhotos.length === 0) {
            setLectureGroups([]);
            setStatus('写真がありません');
            return;
          }


          const subjectPhotos =
            allPhotos.filter((photo) => {
              if (isUnclassified) {
                return isUnclassifiedPhoto(photo);
              }

              return getPhotoLabel(photo) === subject;
            });


          const grouped: Record<
            string,
            PhotoRecord[]
          > = {};

          subjectPhotos.forEach((photo) => {
            const dateKey = getDateKey(photo);

            if (!grouped[dateKey]) {
              grouped[dateKey] = [];
            }

            grouped[dateKey].push(photo);
          });


          const groups: LectureGroup[] =
            Object.entries(grouped)
              .map(([dateKey, photos]) => {
                const sortedPhotos = [...photos].sort(
                  comparePhotosByLectureOrder
                );

                return {
                  dateKey,
                  dateLabel: getDateLabel(sortedPhotos[0]),
                  photos: sortedPhotos,
                };
              })
              .sort((a, b) => {
                const dateA =
                  new Date(
                    a.photos[0].takenAt
                  ).getTime();

                const dateB =
                  new Date(
                    b.photos[0].takenAt
                  ).getTime();

                return dateA - dateB;
              });


          setLectureGroups(groups);

          setStatus(
            `${subjectPhotos.length}枚の写真`
          );
        } catch (error) {
          console.log(
            '授業写真読み込みエラー:',
            error
          );

          if (active) {
            setLectureGroups([]);
            setStatus('');
            setLoadError(
              '授業写真を読み込めませんでした。データは削除されていません。'
            );
          }
        }
      };

      void loadPhotos();

      return () => {
        active = false;
      };
    }, [isUnclassified, loadRevision, subject])
  );


  const openLectureOcr = async (
    section: LectureSection
  ) => {
    setSelectedLectureSection(section);
    const summaryId = createLectureSummaryId(
      subject,
      section.dateKey
    );
    const sourceOcrSignature =
      createLectureSummarySourceSignature(
        section.ocrItems.map((item) => item.record)
      );
    const savedSummary = lectureSummaryRecords[summaryId];
    const canUseSavedSummary =
      savedSummary !== undefined &&
      savedSummary.sourceOcrSignature ===
        sourceOcrSignature;

    setLectureSummary(
      canUseSavedSummary ? savedSummary.text : ''
    );
    setIsLectureSummarySaved(canUseSavedSummary);
    setSummaryError('');
    setSummarySaveError('');
    setIsGeneratingSummary(false);
    setSummaryAvailability(null);
    setLectureQuestion('');
    setLectureAnswer('');
    setQuestionError('');
    setIsAnsweringQuestion(false);
    setLectureProcessingStatus('');
    setLectureProcessingWarning('');

    try {
      const availability =
        await getLectureSummaryAvailability();

      setSummaryAvailability(availability);
    } catch (error) {
      console.log('端末内AI利用可否確認エラー:', error);
      setSummaryAvailability('unknown');
    }
  };


  const generateAndSaveLectureSummary = async (
    section: LectureSection
  ) => {
    const combinedOcrText =
      section.ocrItems
        .map(
          (item) =>
            `写真${item.photoNumber}\n${item.record.text}`
        )
        .join('\n\n');

    try {
      setIsGeneratingSummary(true);
      setSummaryError('');
      setSummarySaveError('');
      setIsLectureSummarySaved(false);

      const summary = await summarizeLecture(
        combinedOcrText
      );
      const trimmedSummary = summary.trim();

      if (trimmedSummary === '') {
        throw new Error('生成されたまとめが空です');
      }

      setLectureSummary(trimmedSummary);

      try {
        const savedRecord =
          await saveLectureSummaryRecord(
            subject,
            section.dateKey,
            trimmedSummary,
            createLectureSummarySourceSignature(
              section.ocrItems.map(
                (item) => item.record
              )
            )
          );

        setLectureSummaryRecords((records) => ({
          ...records,
          [savedRecord.id]: savedRecord,
        }));
        setIsLectureSummarySaved(true);
      } catch (saveError) {
        console.log(
          '授業まとめ保存エラー:',
          saveError
        );

        setSummarySaveError(
          'まとめは表示できましたが、端末に保存できませんでした。'
        );
      }
    } catch (error) {
      console.log('授業まとめ作成エラー:', error);

      setSummaryError(
        'まとめを作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  };


  const createCompleteLectureSummary = async (
    section: LectureSection
  ) => {
    if (processingLectureDateKey !== null) {
      return;
    }

    setSelectedLectureSection(section);
    setLectureSummary('');
    setIsLectureSummarySaved(false);
    setSummaryError('');
    setSummarySaveError('');
    setSummaryAvailability(null);
    setLectureQuestion('');
    setLectureAnswer('');
    setQuestionError('');
    setLectureProcessingWarning('');
    setProcessingLectureDateKey(section.dateKey);

    try {
      const availability =
        await getLectureSummaryAvailability();

      setSummaryAvailability(availability);

      if (availability !== 'available') {
        return;
      }

      const missingPhotos = section.photos.filter(
        (photo) => photoOcrRecords[photo.id] === undefined
      );

      if (
        missingPhotos.length > 0 &&
        !isStudyPhotoVisionAvailable
      ) {
        setSummaryError(
          '写真の文字認識を利用するには、開発ビルドの再インストールが必要です。'
        );
        return;
      }

      const updatedOcrRecords = {
        ...photoOcrRecords,
      };
      const failedPhotoNumbers: number[] = [];

      for (
        let photoIndex = 0;
        photoIndex < section.photos.length;
        photoIndex += 1
      ) {
        const photo = section.photos[photoIndex];

        setLectureProcessingStatus(
          `写真の文字を認識中 ${photoIndex + 1}/${section.photos.length}`
        );

        if (updatedOcrRecords[photo.id] !== undefined) {
          continue;
        }

        try {
          const blocks = await recognizeText(photo.uri);

          if (blocks.length === 0) {
            failedPhotoNumbers.push(photoIndex + 1);
            continue;
          }

          const savedRecord = await savePhotoOcrRecord(
            photo.id,
            blocks
          );

          updatedOcrRecords[photo.id] = savedRecord;
          setPhotoOcrRecords({ ...updatedOcrRecords });
        } catch (error) {
          console.log(
            `写真${photoIndex + 1}文字認識エラー:`,
            error
          );
          failedPhotoNumbers.push(photoIndex + 1);
        }
      }

      const updatedSection: LectureSection = {
        ...section,
        ocrItems: getLectureOcrItems(
          section.photos,
          updatedOcrRecords
        ),
      };

      setSelectedLectureSection(updatedSection);

      if (updatedSection.ocrItems.length === 0) {
        setSummaryError(
          '写真から文字を認識できなかったため、まとめを作成できませんでした。'
        );
        return;
      }

      if (failedPhotoNumbers.length > 0) {
        setLectureProcessingWarning(
          `写真${failedPhotoNumbers.join('、')}は文字を認識できなかったため、認識できた写真だけでまとめました。`
        );
      }

      setLectureProcessingStatus('まとめを作成中...');
      await generateAndSaveLectureSummary(updatedSection);
    } catch (error) {
      console.log('授業まとめ一括作成エラー:', error);
      setSummaryAvailability((availability) =>
        availability ?? 'unknown'
      );
      setSummaryError(
        'まとめを作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setLectureProcessingStatus('');
      setProcessingLectureDateKey(null);
    }
  };


  const askLectureQuestion = async () => {
    if (
      selectedLectureSection === null ||
      summaryAvailability !== 'available' ||
      isAnsweringQuestion
    ) {
      return;
    }

    const question = lectureQuestion.trim();

    if (question === '') {
      setQuestionError('質問を入力してください。');
      return;
    }

    const combinedOcrText =
      selectedLectureSection.ocrItems
        .map(
          (item) =>
            `写真${item.photoNumber}\n${item.record.text}`
        )
        .join('\n\n');

    try {
      setIsAnsweringQuestion(true);
      setQuestionError('');
      setLectureAnswer('');

      const answer = await answerLectureQuestion(
        combinedOcrText,
        question
      );
      const trimmedAnswer = answer.trim();

      if (trimmedAnswer === '') {
        throw new Error('生成された回答が空です');
      }

      setLectureAnswer(trimmedAnswer);
    } catch (error) {
      console.log('授業内容質問エラー:', error);
      setQuestionError(
        '回答を作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setIsAnsweringQuestion(false);
    }
  };


  const getSummaryUnavailableMessage = () => {
    switch (summaryAvailability) {
      case 'unsupportedBuild':
        return '要約機能を利用するには、開発ビルドの再インストールが必要です。';
      case 'unsupportedOS':
        return '端末内AI要約にはiOS 26以降が必要です。';
      case 'deviceNotEligible':
        return 'この端末はApple Intelligenceに対応していないため、端末内要約を利用できません。';
      case 'appleIntelligenceNotEnabled':
        return 'iPhoneの設定でApple Intelligenceを有効にしてください。';
      case 'modelNotReady':
        return 'Apple Intelligenceのモデルを準備中です。しばらく待ってから再試行してください。';
      case 'unknown':
        return '端末内AI要約を現在利用できません。';
      default:
        return '';
    }
  };


  const addLibraryPhotosToLecture = async (
    section: LectureSection | null,
    lectureNumber: number
  ) => {
    if (importingLectureNumber !== null) {
      return;
    }

    setIsLecturePhotoTargetVisible(false);
    setImportingLectureNumber(lectureNumber);
    setLecturePhotoImportFeedback(null);
    setPhotoLibrarySettingsRequired(false);

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setPhotoLibrarySettingsRequired(
          !permissionResult.canAskAgain
        );
        setLecturePhotoImportFeedback({
          message: permissionResult.canAskAgain
            ? '写真ライブラリへのアクセスが必要です。'
            : 'iPhoneの設定から写真ライブラリへのアクセスを許可してください。',
          isError: true,
        });
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: 20,
          quality: 1,
        });

      if (result.canceled) {
        return;
      }

      const referencePhoto = section?.photos[0];
      const latestLectureTimestamp = Math.max(
        ...lectureGroups.flatMap((group) =>
          group.photos.map((photo) =>
            new Date(photo.takenAt).getTime()
          )
        )
      );
      const referenceDate = referencePhoto === undefined
        ? new Date()
        : new Date(referencePhoto.takenAt);

      if (
        referencePhoto === undefined &&
        Number.isFinite(latestLectureTimestamp) &&
        referenceDate.getTime() <= latestLectureTimestamp
      ) {
        referenceDate.setTime(latestLectureTimestamp);
      }

      if (referencePhoto === undefined) {
        const existingDateKeys = new Set(
          lectureGroups.map((group) => group.dateKey)
        );

        while (
          existingDateKeys.has(
            getDateKeyFromDate(referenceDate)
          )
        ) {
          referenceDate.setDate(referenceDate.getDate() + 1);
        }
      }

      if (Number.isNaN(referenceDate.getTime())) {
        throw new Error('授業回の日付が不正です');
      }

      let savedCount = 0;
      let failedCount = 0;

      for (
        let assetIndex = 0;
        assetIndex < result.assets.length;
        assetIndex += 1
      ) {
        const asset = result.assets[assetIndex];
        const lectureDate = new Date(referenceDate);

        // Keep all selected photos in one date group. A new group uses
        // an estimated date after the latest imported lecture so the
        // lecture list remains in the order in which groups were added.
        lectureDate.setHours(23, 0, assetIndex, 0);

        try {
          await savePhotoFromUri({
            sourceUri: asset.uri,
            takenAt: lectureDate,
            day: referencePhoto?.day ?? '',
            period: referencePhoto?.period ?? null,
            subject,
            takenAtEstimated: true,
          });
          savedCount += 1;
        } catch (error) {
          failedCount += 1;
          console.log(
            '授業回へのライブラリ写真追加エラー:',
            error
          );
        }
      }

      const messages = [
        `第${lectureNumber}回に${savedCount}枚追加しました。`,
      ];

      if (failedCount > 0) {
        messages.push(
          `${failedCount}枚は追加できませんでした。`
        );
      }

      setLecturePhotoImportFeedback({
        message: messages.join('\n'),
        isError: savedCount === 0,
      });

      if (savedCount > 0) {
        setLoadRevision((revision) => revision + 1);
      }
    } catch (error) {
      console.log(
        '授業回への写真追加処理エラー:',
        error
      );
      setLecturePhotoImportFeedback({
        message:
          '写真を追加できませんでした。もう一度お試しください。',
        isError: true,
      });
    } finally {
      setImportingLectureNumber(null);
    }
  };


  const sections: LectureSection[] =
    lectureGroups.map((group, index) => {
      const rows: PhotoRow[] = [];

      for (
        let photoIndex = 0;
        photoIndex < group.photos.length;
        photoIndex += 3
      ) {
        rows.push({
          id: `${group.dateKey}-${photoIndex}`,
          photos: group.photos.slice(
            photoIndex,
            photoIndex + 3
          ),
        });
      }

      return {
        ...group,
        title: isUnclassified
          ? '撮影日'
          : `第${index + 1}回`,
        data: rows,
        ocrItems: getLectureOcrItems(
          group.photos,
          photoOcrRecords
        ),
      };
    });


  const hasCurrentLectureSummary = (
    section: LectureSection
  ) => {
    if (
      section.ocrItems.length !== section.photos.length
    ) {
      return false;
    }

    const summaryId = createLectureSummaryId(
      subject,
      section.dateKey
    );
    const savedSummary = lectureSummaryRecords[summaryId];

    return (
      savedSummary !== undefined &&
      savedSummary.sourceOcrSignature ===
        createLectureSummarySourceSignature(
          section.ocrItems.map((item) => item.record)
        )
    );
  };


  const selectedPhotos = sections
    .flatMap((section) => section.photos)
    .filter((photo) => selectedPhotoIds.has(photo.id));
  const selectedPhotoCount = selectedPhotos.length;
  const reorderedPhotos = reorderedPhotoIds.flatMap(
    (photoId) => {
      const photo = reorderingLectureSection?.photos.find(
        (item) => item.id === photoId
      );

      return photo === undefined ? [] : [photo];
    }
  );


  const openPhotoOrder = (section: LectureSection) => {
    setReorderingLectureSection(section);
    setReorderedPhotoIds(
      section.photos.map((photo) => photo.id)
    );
  };


  const movePhotoOrder = (
    photoId: string,
    direction: -1 | 1
  ) => {
    setReorderedPhotoIds((currentIds) => {
      const currentIndex = currentIds.indexOf(photoId);
      const targetIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= currentIds.length
      ) {
        return currentIds;
      }

      const nextIds = [...currentIds];

      [nextIds[currentIndex], nextIds[targetIndex]] = [
        nextIds[targetIndex],
        nextIds[currentIndex],
      ];

      return nextIds;
    });
  };


  const savePhotoOrder = async () => {
    if (
      reorderingLectureSection === null ||
      savingPhotoOrder
    ) {
      return;
    }

    setSavingPhotoOrder(true);

    try {
      const photos = await loadPhotoRecords();
      const updatedPhotos = applyLecturePhotoOrder(
        photos,
        reorderedPhotoIds
      );

      await savePhotoRecords(updatedPhotos);
      setReorderingLectureSection(null);
      setReorderedPhotoIds([]);
      setLoadRevision((revision) => revision + 1);
    } catch (error) {
      console.log('写真並び替え保存エラー:', error);
      Alert.alert(
        '並び順を保存できませんでした',
        '写真は削除されていません。もう一度お試しください。'
      );
    } finally {
      setSavingPhotoOrder(false);
    }
  };


  const finishPhotoSelection = () => {
    setSelectedPhotoIds(new Set());
    setIsSelectingPhotos(false);
    setBulkLectureModalVisible(false);
    setBulkClassificationModalVisible(false);
  };


  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(photoId)) {
        nextIds.delete(photoId);
      } else {
        nextIds.add(photoId);
      }

      return nextIds;
    });
  };


  const recognizeSelectedPhotos = async () => {
    if (
      selectedPhotoCount === 0 ||
      bulkOperation !== null
    ) {
      return;
    }

    if (!isStudyPhotoVisionAvailable) {
      Alert.alert(
        '開発ビルドが必要です',
        '写真の文字認識はApple Visionを組み込んだ開発ビルドで利用できます。'
      );
      return;
    }

    setBulkOperation('ocr');
    let recognizedCount = 0;
    let failedCount = 0;
    const updatedOcrRecords = { ...photoOcrRecords };

    try {
      for (const selectedPhoto of selectedPhotos) {
        try {
          const blocks = await recognizeText(
            selectedPhoto.uri
          );

          if (blocks.length === 0) {
            failedCount += 1;
            continue;
          }

          const savedRecord = await savePhotoOcrRecord(
            selectedPhoto.id,
            blocks
          );

          updatedOcrRecords[selectedPhoto.id] = savedRecord;
          recognizedCount += 1;
          setPhotoOcrRecords({ ...updatedOcrRecords });
        } catch (error) {
          failedCount += 1;
          console.log('一括文字認識エラー:', error);
        }
      }

      finishPhotoSelection();
      Alert.alert(
        '文字認識が完了しました',
        failedCount === 0
          ? `${recognizedCount}枚の写真を認識しました。`
          : `${recognizedCount}枚を認識し、${failedCount}枚は認識できませんでした。`
      );
    } finally {
      setBulkOperation(null);
    }
  };


  const openBulkClassification = async () => {
    if (
      selectedPhotoCount === 0 ||
      bulkOperation !== null
    ) {
      return;
    }

    setBulkSubjectInput(isUnclassified ? '' : subject);
    setBulkTimetableSubjects([]);
    setBulkClassificationLoadError('');
    setBulkClassificationModalVisible(true);

    try {
      const savedTimetable =
        await AsyncStorage.getItem('timetable');
      const timetable = parseTimetable(savedTimetable);

      setBulkTimetableSubjects(
        getUniqueTimetableSubjects(timetable)
      );
    } catch (error) {
      console.log('一括分類候補読み込みエラー:', error);
      setBulkClassificationLoadError(
        '時間割の授業候補を読み込めませんでした。授業名は手入力できます。'
      );
    }
  };


  const saveBulkClassification = async (
    selectedSubject = bulkSubjectInput
  ) => {
    if (
      selectedPhotoCount === 0 ||
      bulkOperation !== null
    ) {
      return;
    }

    setBulkOperation('classification');

    try {
      const photos = await loadPhotoRecords();
      const normalizedSubject =
        selectedSubject.trim() || null;
      const updatedPhotos = updateSelectedPhotoSubjects(
        photos,
        selectedPhotoIds,
        normalizedSubject
      );

      await savePhotoRecords(updatedPhotos);
      finishPhotoSelection();
      setLoadRevision((revision) => revision + 1);

      Alert.alert(
        '分類を変更しました',
        `${selectedPhotoCount}枚の写真を${
          normalizedSubject ?? '未分類'
        }に変更しました。`
      );
    } catch (error) {
      console.log('一括分類変更エラー:', error);
      Alert.alert(
        '分類を変更できませんでした',
        '写真の分類を保存する際にエラーが発生しました。'
      );
    } finally {
      setBulkOperation(null);
    }
  };


  const moveSelectedPhotos = async (
    targetSection: LectureSection
  ) => {
    if (
      selectedPhotoCount === 0 ||
      bulkOperation !== null
    ) {
      return;
    }

    const targetLecturePhoto = targetSection.photos[0];

    if (targetLecturePhoto === undefined) {
      return;
    }

    setBulkOperation('lecture');

    try {
      const photos = await loadPhotoRecords();
      const updatedPhotos = moveSelectedPhotosToLecture(
        photos,
        selectedPhotoIds,
        targetLecturePhoto
      );

      await savePhotoRecords(updatedPhotos);
      finishPhotoSelection();
      setLoadRevision((revision) => revision + 1);

      Alert.alert(
        '授業回を変更しました',
        `${selectedPhotoCount}枚の写真を${targetSection.title}へ移動しました。必要なまとめは更新状態になります。`
      );
    } catch (error) {
      console.log('一括授業回変更エラー:', error);
      Alert.alert(
        '授業回を変更できませんでした',
        '写真の移動を保存する際にエラーが発生しました。'
      );
    } finally {
      setBulkOperation(null);
    }
  };


  const deleteSelectedPhotos = async () => {
    if (
      selectedPhotoCount === 0 ||
      bulkOperation !== null
    ) {
      return;
    }

    setBulkOperation('delete');

    try {
      const photos = await loadPhotoRecords();
      const photosToDelete = photos.filter((photo) =>
        selectedPhotoIds.has(photo.id)
      );
      const remainingPhotos = removeSelectedPhotos(
        photos,
        selectedPhotoIds
      );

      await savePhotoRecords(remainingPhotos);

      for (const selectedPhoto of photosToDelete) {
        try {
          const photoFile = new File(selectedPhoto.uri);

          if (photoFile.exists) {
            photoFile.delete();
          }
        } catch (error) {
          console.log('一括写真ファイル削除エラー:', error);
        }

        try {
          await deletePhotoOcrRecord(selectedPhoto.id);
        } catch (error) {
          console.log('OCR結果一括削除エラー:', error);
        }
      }

      finishPhotoSelection();
      setLoadRevision((revision) => revision + 1);
      Alert.alert(
        '写真を削除しました',
        `${photosToDelete.length}枚の写真を削除しました。`
      );
    } catch (error) {
      console.log('写真一括削除エラー:', error);
      Alert.alert(
        '写真を削除できませんでした',
        '写真データの保存中にエラーが発生しました。'
      );
    } finally {
      setBulkOperation(null);
    }
  };


  const confirmDeleteSelectedPhotos = () => {
    if (selectedPhotoCount === 0) {
      return;
    }

    Alert.alert(
      `${selectedPhotoCount}枚の写真を削除しますか？`,
      'この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            void deleteSelectedPhotos();
          },
        },
      ]
    );
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: isUnclassified
            ? '未分類の写真'
            : subject || '授業',
          headerBackTitle: openedFromReview
            ? '復習'
            : 'ホーム',
          headerBackVisible: openedFromReview
            ? false
            : undefined,
          headerLeft: openedFromReview
            ? (props) => (
                <HeaderBackButton
                  {...props}
                  label="復習"
                  tintColor="#111"
                  onPress={() => {
                    if (router.canGoBack()) {
                      router.back();
                      return;
                    }

                    router.replace('/explore');
                  }}
                />
              )
            : undefined,
        }}
      />

      {isSelectingPhotos ? (
        <View style={styles.bulkSelectionBar}>
          <View style={styles.bulkSelectionHeader}>
            <View style={styles.bulkSelectionCountRow}>
              {bulkOperation !== null ? (
                <ActivityIndicator
                  size="small"
                  color="#31518f"
                />
              ) : null}

              <Text style={styles.bulkSelectionCount}>
                {selectedPhotoCount}枚選択
              </Text>
            </View>

            <Pressable
              disabled={bulkOperation !== null}
              accessibilityRole="button"
              onPress={finishPhotoSelection}
            >
              <Text style={styles.bulkSelectionDone}>
                完了
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bulkActionList}
          >
            <Pressable
              style={[
                styles.bulkActionButton,
                (selectedPhotoCount === 0 ||
                  bulkOperation !== null) &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={
                selectedPhotoCount === 0 ||
                bulkOperation !== null
              }
              onPress={() => {
                void recognizeSelectedPhotos();
              }}
            >
              <Text style={styles.bulkActionButtonText}>
                文字認識
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.bulkActionButton,
                (selectedPhotoCount === 0 ||
                  bulkOperation !== null) &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={
                selectedPhotoCount === 0 ||
                bulkOperation !== null
              }
              onPress={() => {
                void openBulkClassification();
              }}
            >
              <Text style={styles.bulkActionButtonText}>
                分類変更
              </Text>
            </Pressable>

            {!isUnclassified && sections.length > 1 ? (
              <Pressable
                style={[
                  styles.bulkActionButton,
                  (selectedPhotoCount === 0 ||
                    bulkOperation !== null) &&
                    styles.summaryButtonDisabled,
                ]}
                disabled={
                  selectedPhotoCount === 0 ||
                  bulkOperation !== null
                }
                onPress={() => {
                  setBulkLectureModalVisible(true);
                }}
              >
                <Text style={styles.bulkActionButtonText}>
                  授業回変更
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.bulkDeleteButton,
                (selectedPhotoCount === 0 ||
                  bulkOperation !== null) &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={
                selectedPhotoCount === 0 ||
                bulkOperation !== null
              }
              onPress={confirmDeleteSelectedPhotos}
            >
              <Text style={styles.bulkDeleteButtonText}>
                削除
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      <SectionList
        style={styles.list}
        contentContainerStyle={styles.contentContainer}
        sections={sections}
        keyExtractor={(row) => row.id}
        stickySectionHeadersEnabled={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>
              {isUnclassified
                ? '未分類の写真'
                : subject}
            </Text>

            <Text style={styles.status}>
              {status}
            </Text>

            {!isUnclassified && !isSelectingPhotos ? (
              <Pressable
                style={[
                  styles.addLecturePhotoButton,
                  importingLectureNumber !== null &&
                    styles.summaryButtonDisabled,
                ]}
                disabled={importingLectureNumber !== null}
                accessibilityRole="button"
                onPress={() => {
                  setIsLecturePhotoTargetVisible(true);
                  setLecturePhotoImportFeedback(null);
                  setPhotoLibrarySettingsRequired(false);
                }}
              >
                {importingLectureNumber !== null ? (
                  <ActivityIndicator
                    size="small"
                    color="white"
                  />
                ) : null}

                <Text style={styles.addLecturePhotoButtonText}>
                  {importingLectureNumber !== null
                    ? `第${importingLectureNumber}回に追加中...`
                    : '授業回を選んで写真を追加'}
                </Text>
              </Pressable>
            ) : null}

            {lecturePhotoImportFeedback !== null ? (
              <View>
                <Text
                  style={
                    lecturePhotoImportFeedback.isError
                      ? styles.lecturePhotoImportError
                      : styles.lecturePhotoImportSuccess
                  }
                >
                  {lecturePhotoImportFeedback.message}
                </Text>

                {photoLibrarySettingsRequired ? (
                  <Pressable
                    style={styles.photoLibrarySettingsButton}
                    onPress={() => {
                      void Linking.openSettings();
                    }}
                  >
                    <Text
                      style={styles.photoLibrarySettingsButtonText}
                    >
                      iPhoneの設定を開く
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {sections.length > 0 && !isSelectingPhotos ? (
              <Pressable
                style={styles.startBulkSelectionButton}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedPhotoIds(new Set());
                  setIsSelectingPhotos(true);
                }}
              >
                <Text style={styles.startBulkSelectionButtonText}>
                  写真を複数選択
                </Text>
              </Pressable>
            ) : null}

            {loadError !== '' ? (
              <LoadErrorCard
                message={loadError}
                onRetry={() => {
                  setLoadRevision(
                    (revision) => revision + 1
                  );
                }}
              />
            ) : null}

            {ocrLoadError !== '' ? (
              <LoadErrorCard
                message={ocrLoadError}
                onRetry={() => {
                  setLoadRevision(
                    (revision) => revision + 1
                  );
                }}
              />
            ) : null}

            {summaryLoadError !== '' ? (
              <LoadErrorCard
                message={summaryLoadError}
                onRetry={() => {
                  setLoadRevision(
                    (revision) => revision + 1
                  );
                }}
              />
            ) : null}

            {isUnclassified ? (
              <Text style={styles.unclassifiedHint}>
                写真を開き「分類を変更」から授業名を設定できます。
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loadError !== '' ? null : (
            <Text style={styles.emptyText}>
              {isUnclassified
                ? '未分類の写真はありません'
                : 'この授業の写真はありません'}
            </Text>
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.lectureHeader}>
            <View style={styles.lectureHeaderRow}>
              <Text style={styles.lectureTitle}>
                {section.title}
              </Text>

              <Text style={styles.dateText}>
                {section.dateLabel}
              </Text>

              <Text style={styles.photoCount}>
                {section.photos.length}枚
              </Text>
            </View>

            <Pressable
              style={[
                styles.lectureOcrButton,
                (processingLectureDateKey !== null ||
                  isSelectingPhotos) &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={
                processingLectureDateKey !== null ||
                isSelectingPhotos
              }
              onPress={() => {
                if (hasCurrentLectureSummary(section)) {
                  void openLectureOcr(section);
                  return;
                }

                void createCompleteLectureSummary(section);
              }}
            >
              {processingLectureDateKey ===
              section.dateKey ? (
                <ActivityIndicator
                  size="small"
                  color="#28794c"
                />
              ) : null}

              <Text style={styles.lectureOcrButtonText}>
                {processingLectureDateKey === section.dateKey
                  ? lectureProcessingStatus ||
                    '準備中...'
                  : hasCurrentLectureSummary(section)
                    ? 'まとめを見る'
                    : 'まとめを作成'}
              </Text>
            </Pressable>

            {section.photos.length > 1 ? (
              <Pressable
                style={[
                  styles.photoOrderButton,
                  isSelectingPhotos &&
                    styles.summaryButtonDisabled,
                ]}
                disabled={isSelectingPhotos}
                accessibilityRole="button"
                onPress={() => openPhotoOrder(section)}
              >
                <Text style={styles.photoOrderButtonText}>
                  写真を並び替え
                </Text>
              </Pressable>
            ) : null}

          </View>
        )}
        renderItem={({ item: row }) => (
          <View style={styles.photoRow}>
            {row.photos.map((photo) => {
              const isSelected = selectedPhotoIds.has(photo.id);

              return (
                <Pressable
                  key={photo.id}
                  style={[
                    styles.photoButton,
                    isSelected && styles.selectedPhotoButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isSelectingPhotos
                      ? `写真を${isSelected ? '選択解除' : '選択'}`
                      : '写真を大きく表示'
                  }
                  accessibilityState={{ selected: isSelected }}
                  onLongPress={() => {
                    if (!isSelectingPhotos) {
                      setIsSelectingPhotos(true);
                      setSelectedPhotoIds(new Set([photo.id]));
                    }
                  }}
                  onPress={() => {
                    if (isSelectingPhotos) {
                      togglePhotoSelection(photo.id);
                      return;
                    }

                    router.push({
                      pathname: '/photo/[id]',
                      params: { id: photo.id },
                    });
                  }}
                >
                  {failedPhotoIds[photo.id] ? (
                    <View style={styles.photoError}>
                      <Text style={styles.photoErrorText}>
                        画像を表示できません
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photo}
                      contentFit="cover"
                      allowDownscaling
                      enforceEarlyResizing
                      cachePolicy="disk"
                      onError={(error) => {
                        console.log(
                          '画像表示エラー:',
                          error.error
                        );

                        setFailedPhotoIds(
                          (currentIds) => ({
                            ...currentIds,
                            [photo.id]: true,
                          })
                        );
                      }}
                    />
                  )}

                  {isSelectingPhotos ? (
                    <View
                      style={[
                        styles.photoSelectionIndicator,
                        isSelected &&
                          styles.photoSelectionIndicatorSelected,
                      ]}
                    >
                      <Text style={styles.photoSelectionIndicatorText}>
                        {isSelected ? '✓' : ''}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
        renderSectionFooter={() => (
          <View style={styles.lectureFooter} />
        )}
      />

      <Modal
        visible={reorderingLectureSection !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingPhotoOrder) {
            setReorderingLectureSection(null);
            setReorderedPhotoIds([]);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.photoOrderModalContent}>
            <Text style={styles.modalTitle}>
              {reorderingLectureSection?.title ?? ''}
              の写真を並び替え
            </Text>

            <Text style={styles.lectureTargetDescription}>
              「前へ」と「後ろへ」で表示順を変更し、最後に保存してください。
            </Text>

            <ScrollView
              style={styles.photoOrderList}
              contentContainerStyle={styles.photoOrderListContent}
            >
              {reorderedPhotos.map((photo, index) => (
                <View
                  key={photo.id}
                  style={styles.photoOrderRow}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photoOrderThumbnail}
                    contentFit="cover"
                    allowDownscaling
                    cachePolicy="disk"
                  />

                  <Text style={styles.photoOrderPosition}>
                    {index + 1}
                  </Text>

                  <View style={styles.photoOrderControls}>
                    <Pressable
                      style={[
                        styles.photoOrderMoveButton,
                        index === 0 &&
                          styles.summaryButtonDisabled,
                      ]}
                      disabled={
                        index === 0 || savingPhotoOrder
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`写真${index + 1}を前へ移動`}
                      onPress={() => {
                        movePhotoOrder(photo.id, -1);
                      }}
                    >
                      <Text style={styles.photoOrderMoveButtonText}>
                        ↑ 前へ
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.photoOrderMoveButton,
                        index === reorderedPhotos.length - 1 &&
                          styles.summaryButtonDisabled,
                      ]}
                      disabled={
                        index === reorderedPhotos.length - 1 ||
                        savingPhotoOrder
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`写真${index + 1}を後ろへ移動`}
                      onPress={() => {
                        movePhotoOrder(photo.id, 1);
                      }}
                    >
                      <Text style={styles.photoOrderMoveButtonText}>
                        ↓ 後ろへ
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={[
                styles.photoOrderSaveButton,
                savingPhotoOrder &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={savingPhotoOrder}
              accessibilityRole="button"
              onPress={() => {
                void savePhotoOrder();
              }}
            >
              {savingPhotoOrder ? (
                <ActivityIndicator
                  size="small"
                  color="white"
                />
              ) : null}

              <Text style={styles.photoOrderSaveButtonText}>
                {savingPhotoOrder
                  ? '保存中...'
                  : 'この順番で保存'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.bulkModalCancelButton}
              disabled={savingPhotoOrder}
              onPress={() => {
                setReorderingLectureSection(null);
                setReorderedPhotoIds([]);
              }}
            >
              <Text style={styles.bulkModalCancelButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={bulkLectureModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (bulkOperation === null) {
            setBulkLectureModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.lectureTargetModalContent}>
            <Text style={styles.modalTitle}>
              授業回を一括変更
            </Text>

            <Text style={styles.lectureTargetDescription}>
              選択した{selectedPhotoCount}枚の移動先を選んでください。
            </Text>

            <ScrollView
              style={styles.lectureTargetList}
              contentContainerStyle={styles.lectureTargetListContent}
            >
              {sections.map((section) => (
                <Pressable
                  key={section.dateKey}
                  style={styles.lectureTargetButton}
                  disabled={bulkOperation !== null}
                  accessibilityRole="button"
                  onPress={() => {
                    void moveSelectedPhotos(section);
                  }}
                >
                  <Text style={styles.lectureTargetButtonTitle}>
                    {section.title}
                  </Text>

                  <Text style={styles.lectureTargetButtonDetail}>
                    {section.dateLabel}・{section.photos.length}枚
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {bulkOperation === 'lecture' ? (
              <View style={styles.bulkModalProgress}>
                <ActivityIndicator
                  size="small"
                  color="#31518f"
                />
                <Text style={styles.bulkModalProgressText}>
                  授業回を変更中...
                </Text>
              </View>
            ) : null}

            <Pressable
              style={styles.closeButton}
              disabled={bulkOperation !== null}
              onPress={() => {
                setBulkLectureModalVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={bulkClassificationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (bulkOperation === null) {
            setBulkClassificationModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.bulkClassificationModalContent}>
            <Text style={styles.modalTitle}>
              分類を一括変更
            </Text>

            <Text style={styles.lectureTargetDescription}>
              選択した{selectedPhotoCount}枚に設定する授業名を選ぶか、入力してください。
            </Text>

            {bulkTimetableSubjects.length > 0 ? (
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.bulkSubjectCandidates}
                contentContainerStyle={styles.bulkSubjectCandidatesContent}
              >
                {bulkTimetableSubjects.map((candidate) => (
                  <Pressable
                    key={candidate}
                    style={styles.bulkSubjectCandidateButton}
                    disabled={bulkOperation !== null}
                    onPress={() => {
                      void saveBulkClassification(candidate);
                    }}
                  >
                    <Text style={styles.bulkSubjectCandidateText}>
                      {candidate}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {bulkClassificationLoadError !== '' ? (
              <Text style={styles.lecturePhotoImportError}>
                {bulkClassificationLoadError}
              </Text>
            ) : null}

            <TextInput
              style={styles.bulkSubjectInput}
              value={bulkSubjectInput}
              onChangeText={setBulkSubjectInput}
              placeholder="例：高分子化学"
              editable={bulkOperation === null}
            />

            <Pressable
              style={[
                styles.bulkClassificationSaveButton,
                bulkOperation !== null &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={bulkOperation !== null}
              onPress={() => {
                void saveBulkClassification();
              }}
            >
              <Text style={styles.bulkClassificationSaveButtonText}>
                {bulkOperation === 'classification'
                  ? '保存中...'
                  : '保存'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.bulkUnclassifiedButton}
              disabled={bulkOperation !== null}
              onPress={() => {
                void saveBulkClassification('');
              }}
            >
              <Text style={styles.bulkUnclassifiedButtonText}>
                未分類にする
              </Text>
            </Pressable>

            <Pressable
              style={styles.bulkModalCancelButton}
              disabled={bulkOperation !== null}
              onPress={() => {
                setBulkClassificationModalVisible(false);
              }}
            >
              <Text style={styles.bulkModalCancelButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLecturePhotoTargetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsLecturePhotoTargetVisible(false);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.lectureTargetModalContent}>
            <Text style={styles.modalTitle}>
              追加先の授業回
            </Text>

            <Text style={styles.lectureTargetDescription}>
              写真を追加する回を選んでください。まだ写真がない場合は、一番下の新しい回を選べます。
            </Text>

            <ScrollView
              style={styles.lectureTargetList}
              contentContainerStyle={styles.lectureTargetListContent}
            >
              {sections.map((section, index) => (
                <Pressable
                  key={section.dateKey}
                  style={styles.lectureTargetButton}
                  accessibilityRole="button"
                  onPress={() => {
                    void addLibraryPhotosToLecture(
                      section,
                      index + 1
                    );
                  }}
                >
                  <Text style={styles.lectureTargetButtonTitle}>
                    第{index + 1}回
                  </Text>

                  <Text style={styles.lectureTargetButtonDetail}>
                    {section.dateLabel}・{section.photos.length}枚
                  </Text>
                </Pressable>
              ))}

              <Pressable
                style={[
                  styles.lectureTargetButton,
                  styles.newLectureTargetButton,
                ]}
                accessibilityRole="button"
                onPress={() => {
                  void addLibraryPhotosToLecture(
                    null,
                    sections.length + 1
                  );
                }}
              >
                <Text style={styles.lectureTargetButtonTitle}>
                  第{sections.length + 1}回
                </Text>

                <Text style={styles.newLectureTargetDetail}>
                  写真未追加・新しい回
                </Text>
              </Pressable>
            </ScrollView>

            <Pressable
              style={styles.closeButton}
              accessibilityRole="button"
              onPress={() => {
                setIsLecturePhotoTargetVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>
                キャンセル
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedLectureSection !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (processingLectureDateKey === null) {
            setSelectedLectureSection(null);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedLectureSection?.title}のまとめ
            </Text>

            <Text style={styles.modalSubtitle}>
              {selectedLectureSection?.dateLabel}・
              {selectedLectureSection?.ocrItems.length ?? 0}/
              {selectedLectureSection?.photos.length ?? 0}枚を認識済み
            </Text>

            <Text style={styles.ocrNotice}>
              写真の文字認識とまとめ作成は、このiPhone内で行います。
            </Text>

            {lectureProcessingStatus !== '' ? (
              <View style={styles.summaryStatusRow}>
                <ActivityIndicator
                  size="small"
                  color="#28794c"
                />

                <Text style={styles.summaryStatusText}>
                  {lectureProcessingStatus}
                </Text>
              </View>
            ) : null}

            {summaryAvailability === null ? (
              <View style={styles.summaryStatusRow}>
                <ActivityIndicator
                  size="small"
                  color="#28794c"
                />

                <Text style={styles.summaryStatusText}>
                  端末内AIを確認中...
                </Text>
              </View>
            ) : summaryAvailability === 'available' ? (
              <View>
                <Pressable
                  style={[
                    styles.summaryButton,
                    (isGeneratingSummary ||
                      processingLectureDateKey !== null) &&
                      styles.summaryButtonDisabled,
                  ]}
                  disabled={
                    isGeneratingSummary ||
                    processingLectureDateKey !== null
                  }
                  onPress={() => {
                    if (selectedLectureSection !== null) {
                      void createCompleteLectureSummary(
                        selectedLectureSection
                      );
                    }
                  }}
                >
                  {isGeneratingSummary ? (
                    <ActivityIndicator
                      size="small"
                      color="white"
                    />
                  ) : null}

                  <Text style={styles.summaryButtonText}>
                    {isGeneratingSummary
                      ? 'まとめを作成中...'
                      : lectureSummary === ''
                        ? 'この回のまとめを作成'
                        : 'まとめを作り直す'}
                  </Text>
                </Pressable>

                <Text style={styles.onDeviceNotice}>
                  OCR文字は外部に送信せず、このiPhone内でまとめ、保存します。
                </Text>
              </View>
            ) : (
              <Text style={styles.summaryUnavailableText}>
                {getSummaryUnavailableMessage()}
              </Text>
            )}

            {summaryError !== '' ? (
              <Text style={styles.summaryErrorText}>
                {summaryError}
              </Text>
            ) : null}

            {summarySaveError !== '' ? (
              <Text style={styles.summaryErrorText}>
                {summarySaveError}
              </Text>
            ) : null}

            {lectureProcessingWarning !== '' ? (
              <Text style={styles.summaryWarningText}>
                {lectureProcessingWarning}
              </Text>
            ) : null}

            <ScrollView
              style={styles.ocrScrollView}
              keyboardShouldPersistTaps="handled"
            >
              {lectureSummary !== '' ? (
                <View style={styles.summaryResult}>
                  <Text style={styles.summaryResultTitle}>
                    この回のまとめ
                  </Text>

                  {isLectureSummarySaved ? (
                    <Text style={styles.summarySavedText}>
                      端末に保存済み
                    </Text>
                  ) : null}

                  <LectureSummaryReviewPoints
                    summaryText={lectureSummary}
                  />

                  <Text
                    style={styles.summaryResultText}
                    selectable
                  >
                    {lectureSummary}
                  </Text>
                </View>
              ) : null}

              {summaryAvailability === 'available' ? (
                <View style={styles.questionSection}>
                  <Text style={styles.questionTitle}>
                    この回について質問
                  </Text>

                  <Text style={styles.questionDescription}>
                    認識した文字の範囲で、端末内AIが回答します。
                  </Text>

                  <TextInput
                    style={styles.questionInput}
                    value={lectureQuestion}
                    onChangeText={(value) => {
                      setLectureQuestion(value);
                      setQuestionError('');
                    }}
                    placeholder="例：この回の重要な用語は？"
                    multiline
                    maxLength={500}
                    editable={!isAnsweringQuestion}
                  />

                  <Pressable
                    style={[
                      styles.questionButton,
                      (isAnsweringQuestion ||
                        lectureQuestion.trim() === '') &&
                        styles.summaryButtonDisabled,
                    ]}
                    disabled={
                      isAnsweringQuestion ||
                      lectureQuestion.trim() === ''
                    }
                    onPress={() => {
                      void askLectureQuestion();
                    }}
                  >
                    {isAnsweringQuestion ? (
                      <ActivityIndicator
                        size="small"
                        color="white"
                      />
                    ) : null}

                    <Text style={styles.questionButtonText}>
                      {isAnsweringQuestion
                        ? '回答を作成中...'
                        : '質問する'}
                    </Text>
                  </Pressable>

                  {questionError !== '' ? (
                    <Text style={styles.summaryErrorText}>
                      {questionError}
                    </Text>
                  ) : null}

                  {lectureAnswer !== '' ? (
                    <View style={styles.answerResult}>
                      <Text style={styles.answerTitle}>
                        回答
                      </Text>

                      <Text
                        style={styles.answerText}
                        selectable
                      >
                        {lectureAnswer}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {selectedLectureSection?.ocrItems.map((item) => (
                <View
                  style={styles.ocrPhotoSection}
                  key={item.record.photoId}
                >
                  <Text style={styles.ocrPhotoTitle}>
                    写真{item.photoNumber}
                  </Text>

                  <Text
                    style={styles.ocrText}
                    selectable
                  >
                    {item.record.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={[
                styles.closeButton,
                processingLectureDateKey !== null &&
                  styles.summaryButtonDisabled,
              ]}
              disabled={processingLectureDateKey !== null}
              onPress={() => setSelectedLectureSection(null)}
            >
              <Text style={styles.closeButtonText}>
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
    backgroundColor: 'white',
  },

  list: {
    flex: 1,
  },

  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  bulkSelectionBar: {
    backgroundColor: '#f3f6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#d4dcf1',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },

  bulkSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  bulkSelectionCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  bulkSelectionCount: {
    color: '#111',
    fontSize: 16,
    fontWeight: 'bold',
  },

  bulkSelectionDone: {
    color: '#31518f',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },

  bulkActionList: {
    gap: 8,
    paddingTop: 10,
  },

  bulkActionButton: {
    backgroundColor: '#31518f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  bulkActionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },

  bulkDeleteButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#b43c3c',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  bulkDeleteButtonText: {
    color: '#a72e2e',
    fontSize: 13,
    fontWeight: 'bold',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'black',
    marginTop: 30,
  },

  status: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    marginBottom: 12,
  },

  unclassifiedHint: {
    fontSize: 14,
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 8,
    padding: 12,
    lineHeight: 20,
    marginBottom: 28,
  },

  emptyText: {
    fontSize: 16,
    color: '#777',
    marginTop: 16,
  },

  lectureHeader: {
    marginTop: 16,
    marginBottom: 12,
  },

  lectureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  lectureOcrButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 9,
  },

  lectureOcrButtonText: {
    color: '#28794c',
    fontSize: 12,
    fontWeight: 'bold',
  },

  photoOrderButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 8,
  },

  photoOrderButtonText: {
    color: '#31518f',
    fontSize: 12,
    fontWeight: 'bold',
  },

  addLecturePhotoButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#31518f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },

  addLecturePhotoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  lecturePhotoImportSuccess: {
    color: '#28794c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  lecturePhotoImportError: {
    color: '#9b2c2c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  photoLibrarySettingsButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },

  photoLibrarySettingsButtonText: {
    color: '#333',
    fontSize: 12,
    fontWeight: 'bold',
  },

  startBulkSelectionButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#31518f',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },

  startBulkSelectionButtonText: {
    color: '#31518f',
    fontSize: 14,
    fontWeight: 'bold',
  },

  lectureTargetModalContent: {
    maxHeight: '78%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  photoOrderModalContent: {
    maxHeight: '84%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  photoOrderList: {
    flexShrink: 1,
    marginTop: 14,
  },

  photoOrderListContent: {
    gap: 9,
  },

  photoOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    padding: 8,
  },

  photoOrderThumbnail: {
    width: 58,
    height: 58,
    borderRadius: 7,
    backgroundColor: '#e5e5e5',
  },

  photoOrderPosition: {
    width: 22,
    color: '#111',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  photoOrderControls: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 7,
  },

  photoOrderMoveButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },

  photoOrderMoveButtonText: {
    color: '#31518f',
    fontSize: 12,
    fontWeight: 'bold',
  },

  photoOrderSaveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#31518f',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },

  photoOrderSaveButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },

  lectureTargetDescription: {
    color: '#555',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  lectureTargetList: {
    flexShrink: 1,
    marginTop: 14,
  },

  lectureTargetListContent: {
    gap: 8,
  },

  lectureTargetButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  newLectureTargetButton: {
    backgroundColor: '#eef8f2',
    borderColor: '#9bc9aa',
  },

  lectureTargetButtonTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: 'bold',
  },

  lectureTargetButtonDetail: {
    color: '#555',
    fontSize: 13,
  },

  newLectureTargetDetail: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
  },

  lectureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },

  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },

  photoCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },

  lectureFooter: {
    height: 20,
  },

  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },

  photoButton: {
    width: '31.5%',
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },

  selectedPhotoButton: {
    borderWidth: 3,
    borderColor: '#31518f',
  },

  photoSelectionIndicator: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  photoSelectionIndicatorSelected: {
    backgroundColor: '#31518f',
  },

  photoSelectionIndicatorText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 18,
  },

  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#eee',
  },

  photoError: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },

  photoErrorText: {
    color: '#777',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 22,
  },

  modalContent: {
    maxHeight: '84%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  bulkModalProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },

  bulkModalProgressText: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
  },

  bulkClassificationModalContent: {
    maxHeight: '84%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  bulkSubjectCandidates: {
    flexGrow: 0,
    marginTop: 14,
  },

  bulkSubjectCandidatesContent: {
    gap: 8,
    paddingRight: 4,
  },

  bulkSubjectCandidateButton: {
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  bulkSubjectCandidateText: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
  },

  bulkSubjectInput: {
    color: '#111',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 9,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 14,
  },

  bulkClassificationSaveButton: {
    backgroundColor: '#31518f',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },

  bulkClassificationSaveButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  bulkUnclassifiedButton: {
    borderWidth: 1,
    borderColor: '#9b2c2c',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 9,
  },

  bulkUnclassifiedButtonText: {
    color: '#9b2c2c',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  bulkModalCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 4,
  },

  bulkModalCancelButtonText: {
    color: '#444',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  modalTitle: {
    color: '#111',
    fontSize: 21,
    fontWeight: 'bold',
  },

  modalSubtitle: {
    color: '#555',
    fontSize: 13,
    marginTop: 5,
  },

  ocrNotice: {
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    marginTop: 12,
  },

  ocrScrollView: {
    marginTop: 8,
    flexShrink: 1,
  },

  summaryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  summaryStatusText: {
    color: '#555',
    fontSize: 13,
    marginLeft: 8,
  },

  summaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#28794c',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },

  summaryButtonDisabled: {
    opacity: 0.65,
  },

  summaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  onDeviceNotice: {
    color: '#555',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },

  summaryUnavailableText: {
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    marginTop: 12,
  },

  summaryErrorText: {
    color: '#9b2c2c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  summaryWarningText: {
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    marginTop: 10,
  },

  summaryResult: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },

  summaryResultTitle: {
    color: '#28794c',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  summarySavedText: {
    color: '#28794c',
    fontSize: 11,
    marginTop: -4,
    marginBottom: 8,
  },

  summaryResultText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 22,
  },

  questionSection: {
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },

  questionTitle: {
    color: '#31518f',
    fontSize: 15,
    fontWeight: 'bold',
  },

  questionDescription: {
    color: '#555',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  questionInput: {
    minHeight: 72,
    color: '#222',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#b9c5df',
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 10,
    textAlignVertical: 'top',
  },

  questionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#31518f',
    borderRadius: 8,
    padding: 11,
    marginTop: 9,
  },

  questionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  answerResult: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 11,
    marginTop: 10,
  },

  answerTitle: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },

  answerText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 22,
  },

  ocrPhotoSection: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 12,
  },

  ocrPhotoTitle: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },

  ocrText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 21,
  },

  closeButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  closeButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
