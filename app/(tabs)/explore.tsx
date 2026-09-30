import {
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
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

import {
  router,
  useFocusEffect,
} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

import { LoadErrorCard } from '@/components/load-error-card';
import {
  LectureSummaryReviewPoints,
} from '@/components/lecture-summary-review-points';
import { loadExamPreparationRecords } from '@/services/exam-preparation-storage';
import { loadAcademicTerm } from '@/services/academic-term-storage';
import { loadFlashcardRecords } from '@/services/flashcard-storage';
import {
  deleteLectureSummaryRecord,
  loadLectureSummaryRecords,
  updateLectureSummaryText,
} from '@/services/lecture-summary-storage';
import { loadPhotoOcrRecords } from '@/services/photo-ocr-storage';
import { loadPhotoRecords } from '@/services/photo-storage';
import { loadPracticeQuestionRecords } from '@/services/practice-question-storage';
import {
  createExamPreparationRecordId,
  createExamPreparationSourceSignature,
  type ExamPreparationRecords,
} from '@/types/exam-preparation';
import {
  formatAcademicTerm,
  getDefaultAcademicTerm,
  type AcademicTerm,
} from '@/types/academic-term';
import {
  createFlashcardRecordId,
  createFlashcardSourceSignature,
  type FlashcardRecords,
} from '@/types/flashcard';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';
import type { PhotoOcrRecords } from '@/types/photo-ocr';
import {
  matchesStudySearchText,
  normalizeStudySearchText,
  searchRecognizedPhotos,
} from '@/types/photo-search';
import {
  isUnclassifiedPhoto,
  type PhotoRecord,
} from '@/types/photo';
import {
  createPracticeQuestionRecordId,
  createPracticeQuestionSourceSignature,
  type PracticeQuestionRecords,
} from '@/types/practice-question';
import {
  parseTimetable,
  type Timetable,
} from '@/utils/classification';
import {
  timetableDays,
  type TimetableDay,
} from '@/utils/timetable-recognition';
import {
  defaultTimetableDisplayOptions,
  getEnabledPeriodNumbers,
  getEnabledTimetableDays,
  loadTimetableDisplayOptions,
  type TimetableDisplayOptions,
} from '@/utils/timetable-display-options';
import {
  buildSubjectReviewProgress,
  getOverallLearningCompletion,
  getSubjectLearningCompletion,
  getSubjectReviewPendingCount,
  sortSubjectReviewProgressByAttention,
  subjectFlashcardsAreMissing,
  subjectNeedsAttention,
  subjectPracticeIsMissing,
} from '@/utils/review-progress';
import {
  defaultReviewDisplayOptions,
  loadReviewDisplayOptions,
  saveReviewDisplayOptions,
  type ReviewDisplayOptions,
} from '@/utils/review-display-options';


type ReviewMode = 'lecture' | 'subject';
type ReviewDay = TimetableDay | 'すべて';
type ImportantReviewFilter = 'pending' | 'all';
type SubjectClassSlot = {
  day: TimetableDay;
  period: number;
};


const photoSearchPageSize = 20;


const getDateLabel = (dateKey: string) => {
  const [, month, day] = dateKey.split('-');

  if (month === undefined || day === undefined) {
    return dateKey;
  }

  return `${Number(month)}月${Number(day)}日`;
};


const getPhotoLabel = (photo: PhotoRecord) => {
  if (photo.subject !== null && photo.subject !== '') {
    return photo.subject;
  }

  if (photo.day !== '' && photo.period !== null) {
    return `${photo.day}曜${photo.period}限`;
  }

  return '未分類';
};


const getPhotoDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);

  if (Number.isNaN(date.getTime())) {
    return takenAt;
  }

  return date.toLocaleDateString('ja-JP');
};


const getPhotoDateKey = (takenAt: string) => {
  const date = new Date(takenAt);

  if (Number.isNaN(date.getTime())) {
    return takenAt;
  }

  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ].join('-');
};


const getReviewSubject = (photo: PhotoRecord) =>
  isUnclassifiedPhoto(photo)
    ? '未分類'
    : photo.subject as string;


export default function ReviewScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const lectureSwipeX = useRef(
    new Animated.Value(0)
  ).current;
  const hasLoadedDataRef = useRef(false);
  const reviewPagerRef = useRef<ScrollView>(null);
  const reviewPageWidth = Math.max(0, screenWidth - 48);
  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [academicTerm, setAcademicTerm] =
    useState<AcademicTerm>(getDefaultAcademicTerm());
  const [selectedSummary, setSelectedSummary] =
    useState<LectureSummaryRecord | null>(null);
  const [isEditingSummary, setIsEditingSummary] =
    useState(false);
  const editedSummaryTextRef = useRef('');
  const [summaryEditError, setSummaryEditError] =
    useState('');
  const [isSavingSummary, setIsSavingSummary] =
    useState(false);
  const [isDeletingSummary, setIsDeletingSummary] =
    useState(false);
  const [summaryDeleteError, setSummaryDeleteError] =
    useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);
  const [reviewMode, setReviewMode] =
    useState<ReviewMode>('subject');
  const [selectedReviewDay, setSelectedReviewDay] =
    useState<ReviewDay>('すべて');
  const [selectedLectureSubject, setSelectedLectureSubject] =
    useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [photoSearchLimit, setPhotoSearchLimit] =
    useState(photoSearchPageSize);
  const [showImportantPhotos, setShowImportantPhotos] =
    useState(false);
  const [importantPhotoLimit, setImportantPhotoLimit] =
    useState(photoSearchPageSize);
  const [selectedImportantSubject, setSelectedImportantSubject] =
    useState<string | null>(null);
  const [importantReviewFilter, setImportantReviewFilter] =
    useState<ImportantReviewFilter>('all');
  const [showNotedPhotos, setShowNotedPhotos] =
    useState(false);
  const [notedPhotoLimit, setNotedPhotoLimit] =
    useState(photoSearchPageSize);
  const [selectedNotedSubject, setSelectedNotedSubject] =
    useState<string | null>(null);
  const [showReviewQueue, setShowReviewQueue] =
    useState(true);
  const [showSubjectProgress, setShowSubjectProgress] =
    useState(false);
  const [examPreparationRecords, setExamPreparationRecords] =
    useState<ExamPreparationRecords>({});
  const [practiceQuestionRecords, setPracticeQuestionRecords] =
    useState<PracticeQuestionRecords>({});
  const [flashcardRecords, setFlashcardRecords] =
    useState<FlashcardRecords>({});
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [timetable, setTimetable] =
    useState<Timetable>({});
  const [displayOptions, setDisplayOptions] =
    useState<TimetableDisplayOptions>(
      defaultTimetableDisplayOptions
    );
  const [reviewDisplayOptions, setReviewDisplayOptions] =
    useState<ReviewDisplayOptions>(
      defaultReviewDisplayOptions
    );
  const [photoOcrRecords, setPhotoOcrRecords] =
    useState<PhotoOcrRecords>({});
  const enabledDays = getEnabledTimetableDays(
    displayOptions
  );
  const enabledPeriods = getEnabledPeriodNumbers(
    displayOptions
  );
  const reviewDays: ReviewDay[] = [
    'すべて',
    ...enabledDays,
  ];

  const summaryGroups = summaries.reduce<
    Record<string, LectureSummaryRecord[]>
  >(
    (groups, summary) => {
      const subjectSummaries =
        groups[summary.subject] ?? [];

      groups[summary.subject] = [
        ...subjectSummaries,
        summary,
      ].sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey)
      );

      return groups;
    },
    {}
  );
  const reviewSubjects = [
    ...new Set([
      ...Object.keys(summaryGroups),
      ...photos.map(getReviewSubject),
    ]),
  ].sort((subjectA, subjectB) =>
    subjectA.localeCompare(subjectB, 'ja')
  );
  const subjectGroups = reviewSubjects.map(
    (subject) => [
      subject,
      summaryGroups[subject] ?? [],
    ] as const
  );
  const getSubjectClassSlots = (
    targetSubject: string
  ): SubjectClassSlot[] => {
    const slotKeys = new Set<string>();

    Object.entries(timetable).forEach(
      ([key, timetableSubject]) => {
        if (timetableSubject.trim() !== targetSubject) {
          return;
        }

        const [day, periodText] = key.split('-');
        const period = Number(periodText);

        if (
          !enabledDays.some(
            (timetableDay) => timetableDay === day
          ) ||
          !enabledPeriods.some(
            (enabledPeriod) => enabledPeriod === period
          )
        ) {
          return;
        }

        slotKeys.add(`${day}-${period}`);
      }
    );

    photos.forEach((photo) => {
      if (
        getReviewSubject(photo) !== targetSubject ||
        photo.period === null ||
        !enabledDays.some(
          (timetableDay) => timetableDay === photo.day
        ) ||
        !enabledPeriods.some(
          (enabledPeriod) => enabledPeriod === photo.period
        )
      ) {
        return;
      }

      slotKeys.add(`${photo.day}-${photo.period}`);
    });

    return [...slotKeys]
      .map((key) => {
        const [day, periodText] = key.split('-');

        return {
          day: day as TimetableDay,
          period: Number(periodText),
        };
      })
      .sort((slotA, slotB) => {
        const dayDifference =
          timetableDays.indexOf(slotA.day) -
          timetableDays.indexOf(slotB.day);

        return dayDifference !== 0
          ? dayDifference
          : slotA.period - slotB.period;
      });
  };
  const getSubjectScheduleLabel = (
    targetSubject: string
  ) => getSubjectClassSlots(targetSubject)
    .map((slot) => `${slot.day}曜${slot.period}限`)
    .join('・');
  const getSubjectPhotoLectureCount = (
    targetSubject: string
  ) => new Set(
    photos
      .filter(
        (photo) => getReviewSubject(photo) === targetSubject
      )
      .map((photo) => getPhotoDateKey(photo.takenAt))
  ).size;
  const normalizedSearchQuery =
    normalizeStudySearchText(searchQuery);
  const photoSearchMatches = searchRecognizedPhotos(
    photos,
    photoOcrRecords,
    searchQuery,
    photoSearchLimit + 1
  );
  const hasMorePhotoSearchResults =
    photoSearchMatches.length > photoSearchLimit;
  const photoSearchResults = photoSearchMatches.slice(
    0,
    photoSearchLimit
  );
  const importantPhotos = photos
    .filter((photo) => photo.isImportant === true)
    .sort(
      (photoA, photoB) =>
        new Date(photoB.takenAt).getTime() -
        new Date(photoA.takenAt).getTime()
    );
  const importantPhotoSubjects = [
    ...new Set(importantPhotos.map(getPhotoLabel)),
  ].sort((subjectA, subjectB) =>
    subjectA.localeCompare(subjectB, 'ja')
  );
  const pendingImportantPhotoCount = importantPhotos.filter(
    (photo) => photo.importantReviewedAt === undefined
  ).length;
  const subjectFilteredImportantPhotos =
    selectedImportantSubject === null
      ? importantPhotos
      : importantPhotos.filter(
          (photo) =>
            getPhotoLabel(photo) === selectedImportantSubject
        );
  const filteredImportantPhotos =
    importantReviewFilter === 'pending'
      ? subjectFilteredImportantPhotos.filter(
          (photo) => photo.importantReviewedAt === undefined
        )
      : subjectFilteredImportantPhotos;
  const visibleImportantPhotos = filteredImportantPhotos.slice(
    0,
    importantPhotoLimit
  );
  const hasMoreImportantPhotos =
    filteredImportantPhotos.length > importantPhotoLimit;
  const notedPhotos = photos
    .filter(
      (photo) =>
        photo.note !== undefined &&
        photo.note.trim() !== ''
    )
    .sort(
      (photoA, photoB) =>
        new Date(photoB.takenAt).getTime() -
        new Date(photoA.takenAt).getTime()
    );
  const notedPhotoSubjects = [
    ...new Set(notedPhotos.map(getPhotoLabel)),
  ].sort((subjectA, subjectB) =>
    subjectA.localeCompare(subjectB, 'ja')
  );
  const filteredNotedPhotos = selectedNotedSubject === null
    ? notedPhotos
    : notedPhotos.filter(
        (photo) =>
          getPhotoLabel(photo) === selectedNotedSubject
      );
  const visibleNotedPhotos = filteredNotedPhotos.slice(
    0,
    notedPhotoLimit
  );
  const hasMoreNotedPhotos =
    filteredNotedPhotos.length > notedPhotoLimit;
  const subjectReviewProgress = buildSubjectReviewProgress({
    summaries,
    photos,
    photoOcrRecords,
    practiceQuestionRecords,
    flashcardRecords,
    examPreparationRecords,
  });
  const overallLearningCompletion =
    getOverallLearningCompletion(subjectReviewProgress);
  const filteredSubjectReviewProgress =
    reviewDisplayOptions.subjectProgressFilterMode ===
    'attention'
      ? subjectReviewProgress.filter(subjectNeedsAttention)
      : subjectReviewProgress;
  const sortedSubjectReviewProgress =
    reviewDisplayOptions.subjectProgressSortMode === 'attention'
      ? sortSubjectReviewProgressByAttention(
          filteredSubjectReviewProgress
        )
      : filteredSubjectReviewProgress;
  const reviewQueueSubjects = subjectReviewProgress
    .filter(
      (progress) =>
        getSubjectReviewPendingCount(progress) > 0
    )
    .sort((progressA, progressB) => {
      const countDifference =
        getSubjectReviewPendingCount(progressB) -
        getSubjectReviewPendingCount(progressA);

      return countDifference !== 0
        ? countDifference
        : progressA.subject.localeCompare(
            progressB.subject,
            'ja'
          );
    });
  const reviewQueueTotal = reviewQueueSubjects.reduce(
    (total, progress) =>
      total + getSubjectReviewPendingCount(progress),
    0
  );
  const summaryMatchesSearch = (
    summary: LectureSummaryRecord
  ) => {
    if (normalizedSearchQuery === '') {
      return true;
    }

    return matchesStudySearchText(
      [
        summary.subject,
        summary.text,
        getDateLabel(summary.dateKey),
      ].join('\n'),
      searchQuery
    );
  };
  const subjectMatchesSelectedDay = (
    targetSubject: string
  ) => {
    if (selectedReviewDay === 'すべて') {
      return true;
    }

    return getSubjectClassSlots(targetSubject).some(
      (slot) => slot.day === selectedReviewDay
    );
  };
  const filteredSubjectGroups = subjectGroups
    .filter(
      ([groupSubject, subjectSummaries]) =>
        subjectMatchesSelectedDay(groupSubject) &&
        matchesStudySearchText(
          [
            groupSubject,
            ...subjectSummaries.flatMap((summary) => [
              summary.text,
              getDateLabel(summary.dateKey),
            ]),
          ].join('\n'),
          searchQuery
        )
    )
    .sort(([subjectA], [subjectB]) => {
      const slotsA = getSubjectClassSlots(subjectA);
      const slotsB = getSubjectClassSlots(subjectB);
      const selectedSlotA = slotsA.find(
        (slot) =>
          selectedReviewDay === 'すべて' ||
          slot.day === selectedReviewDay
      );
      const selectedSlotB = slotsB.find(
        (slot) =>
          selectedReviewDay === 'すべて' ||
          slot.day === selectedReviewDay
      );

      if (selectedSlotA === undefined) {
        return selectedSlotB === undefined
          ? subjectA.localeCompare(subjectB, 'ja')
          : 1;
      }

      if (selectedSlotB === undefined) {
        return -1;
      }

      const dayDifference =
        timetableDays.indexOf(selectedSlotA.day) -
        timetableDays.indexOf(selectedSlotB.day);

      if (dayDifference !== 0) {
        return dayDifference;
      }

      return selectedSlotA.period !== selectedSlotB.period
        ? selectedSlotA.period - selectedSlotB.period
        : subjectA.localeCompare(subjectB, 'ja');
    });
  const filteredExamSubjectGroups = filteredSubjectGroups;
  const selectedSubjectAllSummaries =
    selectedLectureSubject === null
      ? []
      : subjectGroups.find(
          ([groupSubject]) =>
            groupSubject === selectedLectureSubject
        )?.[1] ?? [];
  const selectedSubjectSummaries =
    selectedSubjectAllSummaries.filter(
      summaryMatchesSearch
    );
  const selectedSummaryLectureNumber =
    selectedSummary === null
      ? null
      : subjectGroups
          .find(
            ([groupSubject]) =>
              groupSubject === selectedSummary.subject
          )?.[1]
          .findIndex(
            (summary) => summary.id === selectedSummary.id
          ) ?? -1;

  const lectureSubjectSwipeResponder =
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const horizontalDistance =
          Math.abs(gestureState.dx);
        const verticalDistance =
          Math.abs(gestureState.dy);

        return (
          selectedLectureSubject !== null &&
          gestureState.numberActiveTouches === 1 &&
          gestureState.dx > 12 &&
          horizontalDistance > verticalDistance
        );
      },
      onPanResponderMove: (_, gestureState) => {
        lectureSwipeX.setValue(
          Math.max(0, gestureState.dx)
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= screenWidth * 0.27) {
          Animated.timing(lectureSwipeX, {
            toValue: screenWidth,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setSelectedLectureSubject(null);
            lectureSwipeX.setValue(0);
          });
          return;
        }

        Animated.spring(lectureSwipeX, {
          toValue: 0,
          speed: 22,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(lectureSwipeX, {
          toValue: 0,
          speed: 22,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
      },
    });


  useFocusEffect(
    useCallback(() => {
      // Incrementing this value retries the focus-time load.
      void loadRevision;
      let active = true;

      const loadSummaries = async () => {
        try {
          if (!hasLoadedDataRef.current) {
            setLoading(true);
          }

          setLoadError('');

          const learningDataResults = await Promise.allSettled([
            loadLectureSummaryRecords(),
            loadExamPreparationRecords(),
            loadPracticeQuestionRecords(),
            loadFlashcardRecords(),
            loadPhotoRecords(),
            loadPhotoOcrRecords(),
            AsyncStorage.getItem('timetable'),
            loadAcademicTerm(),
            loadTimetableDisplayOptions(),
            loadReviewDisplayOptions(),
          ]);
          const [
            lectureSummaryResult,
            examPreparationResult,
            practiceQuestionResult,
            flashcardResult,
            photoResult,
            photoOcrResult,
            timetableResult,
            academicTermResult,
            displayOptionsResult,
            reviewDisplayOptionsResult,
          ] = learningDataResults;

          if (!active) {
            return;
          }

          if (lectureSummaryResult.status === 'fulfilled') {
            const sortedSummaries = Object.values(
              lectureSummaryResult.value
            ).sort((a, b) => {
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            });

            setSummaries(sortedSummaries);
            setSelectedLectureSubject((currentSubject) => {
              if (
                currentSubject !== null &&
                !sortedSummaries.some(
                  (summary) =>
                    summary.subject === currentSubject
                )
              ) {
                return null;
              }

              return currentSubject;
            });
            hasLoadedDataRef.current = true;
          } else {
            console.log(
              '復習まとめ読み込みエラー:',
              lectureSummaryResult.reason
            );
            setSummaries([]);
            setLoadError(
              '保存済みの授業まとめを読み込めませんでした。'
            );
          }

          setExamPreparationRecords(
            examPreparationResult.status === 'fulfilled'
              ? examPreparationResult.value
              : {}
          );
          setPracticeQuestionRecords(
            practiceQuestionResult.status === 'fulfilled'
              ? practiceQuestionResult.value
              : {}
          );
          setFlashcardRecords(
            flashcardResult.status === 'fulfilled'
              ? flashcardResult.value
              : {}
          );
          setPhotos(
            photoResult.status === 'fulfilled'
              ? photoResult.value
              : []
          );
          setSelectedImportantSubject((currentSubject) => {
            if (
              currentSubject === null ||
              photoResult.status !== 'fulfilled'
            ) {
              return currentSubject;
            }

            return photoResult.value.some(
              (photo) =>
                photo.isImportant === true &&
                getPhotoLabel(photo) === currentSubject
            )
              ? currentSubject
              : null;
          });
          setSelectedNotedSubject((currentSubject) => {
            if (
              currentSubject === null ||
              photoResult.status !== 'fulfilled'
            ) {
              return currentSubject;
            }

            return photoResult.value.some(
              (photo) =>
                photo.note !== undefined &&
                photo.note.trim() !== '' &&
                getPhotoLabel(photo) === currentSubject
            )
              ? currentSubject
              : null;
          });
          setPhotoOcrRecords(
            photoOcrResult.status === 'fulfilled'
              ? photoOcrResult.value
              : {}
          );
          if (timetableResult.status === 'fulfilled') {
            try {
              setTimetable(
                parseTimetable(timetableResult.value) ?? {}
              );
            } catch (error) {
              console.log('復習時間割解析エラー:', error);
              setTimetable({});
            }
          } else {
            setTimetable({});
          }
          if (academicTermResult.status === 'fulfilled') {
            setAcademicTerm(academicTermResult.value);
          } else {
            console.log(
              '復習学期設定読み込みエラー:',
              academicTermResult.reason
            );
          }
          if (displayOptionsResult.status === 'fulfilled') {
            setDisplayOptions(displayOptionsResult.value);
            setSelectedReviewDay((currentDay) =>
              currentDay === '土' &&
              !displayOptionsResult.value.showSaturday
                ? 'すべて'
                : currentDay
            );
          } else {
            console.log(
              '復習表示範囲読み込みエラー:',
              displayOptionsResult.reason
            );
          }
          if (
            reviewDisplayOptionsResult.status === 'fulfilled'
          ) {
            setReviewDisplayOptions(
              reviewDisplayOptionsResult.value
            );
          } else {
            console.log(
              '復習タブ表示設定読み込みエラー:',
              reviewDisplayOptionsResult.reason
            );
            setReviewDisplayOptions(
              defaultReviewDisplayOptions
            );
          }

          learningDataResults
            .slice(1)
            .forEach((result) => {
              if (result.status === 'rejected') {
                console.log(
                  '学習進捗読み込みエラー:',
                  result.reason
                );
              }
            });
        } catch (error) {
          console.log('復習まとめ読み込みエラー:', error);

          if (active) {
            setSummaries([]);
            setLoadError(
              '保存済みの授業まとめを読み込めませんでした。'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void loadSummaries();

      return () => {
        active = false;
      };
    }, [loadRevision])
  );


  const shareSelectedSummary = async () => {
    if (selectedSummary === null) {
      return;
    }

    const lectureLabel =
      selectedSummaryLectureNumber !== null &&
      selectedSummaryLectureNumber >= 0
        ? `第${selectedSummaryLectureNumber + 1}回`
        : '授業まとめ';

    try {
      await Share.share({
        title: `${selectedSummary.subject} ${lectureLabel}`,
        message: [
          `${selectedSummary.subject} ${lectureLabel}`,
          getDateLabel(selectedSummary.dateKey),
          '',
          selectedSummary.text,
        ].join('\n'),
      });
    } catch (error) {
      console.log('授業まとめ共有エラー:', error);
      Alert.alert(
        '共有できませんでした',
        '授業まとめを共有できませんでした。もう一度お試しください。'
      );
    }
  };


  const openSummary = (summary: LectureSummaryRecord) => {
    setSelectedSummary(summary);
    editedSummaryTextRef.current = summary.text;
    setIsEditingSummary(false);
    setSummaryEditError('');
    setSummaryDeleteError('');
  };


  const openAdjacentSummary = (offset: -1 | 1) => {
    if (
      selectedSummaryLectureNumber === null ||
      selectedSummaryLectureNumber < 0
    ) {
      return;
    }

    const adjacentSummary =
      selectedSubjectAllSummaries[
        selectedSummaryLectureNumber + offset
      ];

    if (adjacentSummary !== undefined) {
      openSummary(adjacentSummary);
    }
  };


  const summarySwipeGesture = Gesture.Pan()
    .enabled(
      selectedSummary !== null &&
      !isEditingSummary &&
      !isDeletingSummary
    )
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd((event) => {
      if (event.translationX <= -35) {
        openAdjacentSummary(1);
      } else if (event.translationX >= 35) {
        openAdjacentSummary(-1);
      }
    });


  const closeSummary = () => {
    setSelectedSummary(null);
    setIsEditingSummary(false);
    setSummaryEditError('');
    setSummaryDeleteError('');
  };


  const deleteSelectedSummary = async () => {
    if (selectedSummary === null || isDeletingSummary) {
      return;
    }

    const summaryToDelete = selectedSummary;

    try {
      setIsDeletingSummary(true);
      setSummaryDeleteError('');

      await deleteLectureSummaryRecord(
        summaryToDelete.id
      );

      const remainingSummaries = summaries.filter(
        (summary) => summary.id !== summaryToDelete.id
      );

      setSummaries(remainingSummaries);
      setSelectedSummary(null);
      setIsEditingSummary(false);

      if (
        !remainingSummaries.some(
          (summary) =>
            summary.subject === summaryToDelete.subject
        )
      ) {
        setSelectedLectureSubject(null);
      }
    } catch (error) {
      console.log('授業まとめ削除エラー:', error);
      setSummaryDeleteError(
        '授業まとめを削除できませんでした。もう一度お試しください。'
      );
    } finally {
      setIsDeletingSummary(false);
    }
  };


  const confirmDeleteSelectedSummary = () => {
    if (selectedSummary === null || isDeletingSummary) {
      return;
    }

    Alert.alert(
      'このまとめを削除しますか？',
      '写真と文字認識結果は削除されません。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            void deleteSelectedSummary();
          },
        },
      ]
    );
  };


  const saveEditedSummary = async () => {
    if (selectedSummary === null || isSavingSummary) {
      return;
    }

    const trimmedText = editedSummaryTextRef.current.trim();

    if (trimmedText === '') {
      setSummaryEditError('まとめ本文を入力してください。');
      return;
    }

    try {
      setIsSavingSummary(true);
      setSummaryEditError('');

      const updatedSummary = await updateLectureSummaryText(
        selectedSummary.id,
        trimmedText
      );

      setSummaries((currentSummaries) =>
        currentSummaries.map((summary) =>
          summary.id === updatedSummary.id
            ? updatedSummary
            : summary
        )
      );
      setSelectedSummary(updatedSummary);
      editedSummaryTextRef.current = updatedSummary.text;
      setIsEditingSummary(false);
    } catch (error) {
      console.log('授業まとめ編集エラー:', error);
      setSummaryEditError(
        'まとめを保存できませんでした。もう一度お試しください。'
      );
    } finally {
      setIsSavingSummary(false);
    }
  };


  const selectReviewMode = (mode: ReviewMode) => {
    if (mode === 'subject') {
      setSelectedLectureSubject(null);
    }

    setReviewMode(mode);
    reviewPagerRef.current?.scrollTo({
      x: mode === 'subject' ? 0 : reviewPageWidth,
      animated: true,
    });
  };


  return (
    <View style={styles.container}>
      <ScrollView
        {...lectureSubjectSwipeResponder.panHandlers}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>
          復習
        </Text>

        <Text style={styles.subtitle}>
          見たい単位を選んで復習
        </Text>

        <Pressable
          style={styles.academicTermButton}
          accessibilityRole="button"
          accessibilityLabel={`${formatAcademicTerm(academicTerm)}、学期を変更`}
          onPress={() => router.push({
            pathname: '/academic-term',
            params: { from: 'review' },
          })}
        >
          <Text style={styles.academicTermText}>
            {formatAcademicTerm(academicTerm)}
          </Text>
          <Text style={styles.academicTermArrow}>
            変更 ›
          </Text>
        </Pressable>

        {loadError !== '' ? (
          <LoadErrorCard
            message={loadError}
            onRetry={() => {
              setLoadRevision((revision) => revision + 1);
            }}
          />
        ) : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#31518f"
            />
            <Text style={styles.loadingText}>
              復習データを読み込み中...
            </Text>
          </View>
        ) : loadError !== '' ? null :
        summaries.length === 0 &&
        photos.length === 0 &&
        Object.keys(practiceQuestionRecords).length === 0 &&
        Object.keys(flashcardRecords).length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              まだ授業まとめがありません
            </Text>

            <Text style={styles.emptyText}>
              授業写真の文字を認識し、「この回のまとめを作成」を押すとここに表示されます。
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={(value) => {
                  setSearchQuery(value);
                  setPhotoSearchLimit(photoSearchPageSize);
                }}
                placeholder="授業名・まとめ・写真内文字・メモを検索"
                placeholderTextColor="#888"
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                accessibilityLabel="授業名、まとめ、写真内の文字、写真メモを検索"
              />
            </View>

            {normalizedSearchQuery !== '' ? (
              <View style={styles.photoSearchSection}>
                <Text style={styles.photoSearchTitle}>
                  写真の文字・メモ（
                  {photoSearchResults.length}件
                  {hasMorePhotoSearchResults ? '以上' : ''}）
                </Text>

                {photoSearchResults.length > 0 ? (
                  <View style={styles.photoSearchList}>
                    {photoSearchResults.map((result) => (
                      <Pressable
                        key={result.photo.id}
                        style={styles.photoSearchCard}
                        accessibilityRole="button"
                        accessibilityLabel={`${getPhotoLabel(result.photo)}の写真を開く`}
                        onPress={() => {
                          router.push({
                            pathname: '/photo/[id]',
                            params: { id: result.photo.id },
                          });
                        }}
                      >
                        <Image
                          style={styles.photoSearchThumbnail}
                          source={{ uri: result.photo.uri }}
                        />

                        <View style={styles.photoSearchText}>
                          <Text style={styles.photoSearchSubject}>
                            {getPhotoLabel(result.photo)}
                          </Text>
                          <Text style={styles.photoSearchDate}>
                            {getPhotoDateLabel(
                              result.photo.takenAt
                            )}
                          </Text>
                          <Text style={styles.photoSearchSource}>
                            {result.source === 'note'
                              ? 'メモに一致'
                              : result.source === 'ocr'
                                ? '認識文字に一致'
                                : 'メモ・認識文字に一致'}
                          </Text>
                          <Text
                            style={styles.photoSearchPreview}
                            numberOfLines={3}
                          >
                            {result.preview}
                          </Text>
                        </View>

                        <Text style={styles.photoSearchOpenText}>
                          ›
                        </Text>
                      </Pressable>
                    ))}

                    {hasMorePhotoSearchResults ? (
                      <Pressable
                        style={styles.photoSearchMoreButton}
                        accessibilityRole="button"
                        accessibilityLabel="写真の検索結果をさらに表示"
                        onPress={() => {
                          setPhotoSearchLimit(
                            (currentLimit) =>
                              currentLimit + photoSearchPageSize
                          );
                        }}
                      >
                        <Text
                          style={styles.photoSearchMoreButtonText}
                        >
                          さらに表示
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.photoSearchEmptyText}>
                    一致する写真はありません
                  </Text>
                )}
              </View>
            ) : null}

            {reviewDisplayOptions.showReviewQueue ? (
              <View style={styles.reviewQueueSection}>
              <Pressable
                style={styles.reviewDashboardHeader}
                accessibilityRole="button"
                accessibilityState={{
                  expanded: showReviewQueue,
                }}
                accessibilityLabel={`復習待ち${reviewQueueTotal}件を${showReviewQueue ? '閉じる' : '開く'}`}
                onPress={() => {
                  setShowReviewQueue(
                    (currentValue) => !currentValue
                  );
                }}
              >
                <View>
                  <Text style={styles.reviewQueueTitle}>
                    復習待ち
                  </Text>
                  <Text style={styles.reviewQueueCount}>
                    {reviewQueueTotal}件
                  </Text>
                </View>

                <Text style={styles.reviewQueueToggle}>
                  {showReviewQueue ? '閉じる ︿' : '開く ﹀'}
                </Text>
              </Pressable>

              {showReviewQueue ? (
                <View style={styles.reviewQueueContent}>
                  {reviewQueueSubjects.length === 0 ? (
                    <Text style={styles.reviewQueueEmptyText}>
                      現在、復習待ちはありません
                    </Text>
                  ) : (
                    reviewQueueSubjects.map((progress) => (
                      <View
                        key={progress.subject}
                        style={styles.reviewQueueCard}
                      >
                        <View style={styles.reviewQueueSubjectRow}>
                          <Text style={styles.reviewQueueSubject}>
                            {progress.subject}
                          </Text>
                          <Text style={styles.reviewQueueSubjectCount}>
                            合計
                            {getSubjectReviewPendingCount(progress)}
                            件
                          </Text>
                        </View>

                        <View style={styles.reviewQueueActions}>
                          {progress.missingSummaryCount > 0 ||
                          progress.outdatedSummaryCount > 0 ? (
                            <Pressable
                              style={styles.reviewQueueUpdateButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/subject/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    from: 'review',
                                    summaryAttentionOnly: 'true',
                                  },
                                });
                              }}
                            >
                              <Text style={styles.reviewQueueUpdateText}>
                                {progress.missingSummaryCount > 0 &&
                                progress.outdatedSummaryCount > 0
                                  ? 'まとめを作成・更新'
                                  : progress.outdatedSummaryCount > 0
                                    ? 'まとめを更新'
                                    : 'まとめを作る'}{' '}
                                {progress.missingSummaryCount +
                                  progress.outdatedSummaryCount}
                                回
                              </Text>
                            </Pressable>
                          ) : null}

                          {progress.practiceIsOutdated ||
                          subjectPracticeIsMissing(progress) ? (
                            <Pressable
                              style={styles.reviewQueueUpdateButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/practice/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    from: 'review',
                                  },
                                });
                              }}
                            >
                              <Text style={styles.reviewQueueUpdateText}>
                                {progress.practiceIsOutdated
                                  ? '練習問題を作り直す'
                                  : '練習問題を作る'}
                              </Text>
                            </Pressable>
                          ) : progress.practiceReviewCount > 0 ? (
                            <Pressable
                              style={styles.reviewQueueActionButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/practice/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    mode: 'review',
                                  },
                                });
                              }}
                            >
                              <Text
                                style={styles.reviewQueueActionText}
                              >
                                練習問題{' '}
                                {progress.practiceReviewCount}問
                              </Text>
                            </Pressable>
                          ) : null}

                          {!progress.practiceIsOutdated &&
                          progress.practiceUnansweredCount > 0 ? (
                            <Pressable
                              style={styles.reviewQueueUnansweredButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/practice/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    mode: 'unanswered',
                                  },
                                });
                              }}
                            >
                              <Text
                                style={styles.reviewQueueUnansweredText}
                              >
                                未回答問題{' '}
                                {progress.practiceUnansweredCount}問
                              </Text>
                            </Pressable>
                          ) : null}

                          {progress.flashcardsAreOutdated ||
                          subjectFlashcardsAreMissing(progress) ? (
                            <Pressable
                              style={styles.reviewQueueUpdateButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/flashcards/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    from: 'review',
                                  },
                                });
                              }}
                            >
                              <Text style={styles.reviewQueueUpdateText}>
                                {progress.flashcardsAreOutdated
                                  ? 'カードを作り直す'
                                  : 'カードを作る'}
                              </Text>
                            </Pressable>
                          ) : progress.flashcardReviewCount > 0 ? (
                            <Pressable
                              style={styles.reviewQueueActionButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/flashcards/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    mode: 'review',
                                  },
                                });
                              }}
                            >
                              <Text
                                style={styles.reviewQueueActionText}
                              >
                                カード{' '}
                                {progress.flashcardReviewCount}枚
                              </Text>
                            </Pressable>
                          ) : null}

                          {progress.examPreparationIsMissing ||
                          progress.examPreparationIsOutdated ? (
                            <Pressable
                              style={styles.reviewQueueUpdateButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/exam-prep/[subject]',
                                  params: {
                                    subject: progress.subject,
                                  },
                                });
                              }}
                            >
                              <Text style={styles.reviewQueueUpdateText}>
                                {progress.examPreparationIsOutdated
                                  ? '試験対策を作り直す'
                                  : '試験対策を作る'}
                              </Text>
                            </Pressable>
                          ) : null}

                          {!progress.flashcardsAreOutdated &&
                          progress.flashcardUnansweredCount > 0 ? (
                            <Pressable
                              style={styles.reviewQueueUnansweredButton}
                              accessibilityRole="button"
                              onPress={() => {
                                router.push({
                                  pathname: '/flashcards/[subject]',
                                  params: {
                                    subject: progress.subject,
                                    mode: 'unanswered',
                                  },
                                });
                              }}
                            >
                              <Text
                                style={styles.reviewQueueUnansweredText}
                              >
                                未回答カード{' '}
                                {progress.flashcardUnansweredCount}枚
                              </Text>
                            </Pressable>
                          ) : null}

                          {progress.importantPhotoCount > 0 ? (
                            <Pressable
                              style={styles.reviewQueuePhotoButton}
                              accessibilityRole="button"
                              onPress={() => {
                                const firstImportantPhoto =
                                  importantPhotos.find(
                                    (photo) =>
                                      photo.importantReviewedAt ===
                                        undefined &&
                                      getPhotoLabel(photo) ===
                                      progress.subject
                                  );

                                if (firstImportantPhoto === undefined) {
                                  return;
                                }

                                router.push({
                                  pathname: '/photo/[id]',
                                  params: {
                                    id: firstImportantPhoto.id,
                                    mode: 'important',
                                    importantSubject:
                                      progress.subject,
                                    importantStatus: 'pending',
                                  },
                                });
                              }}
                            >
                              <Text
                                style={styles.reviewQueuePhotoText}
                              >
                                重要写真{' '}
                                {progress.importantPhotoCount}枚
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
              </View>
            ) : null}

            {reviewDisplayOptions.showSubjectProgress &&
            subjectReviewProgress.length > 0 ? (
              <View style={styles.subjectProgressSection}>
                <Pressable
                  style={styles.reviewDashboardHeader}
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: showSubjectProgress,
                  }}
                  accessibilityLabel={`授業ごとの進捗${subjectReviewProgress.length}科目を${showSubjectProgress ? '閉じる' : '開く'}`}
                  onPress={() => {
                    setShowSubjectProgress(
                      (currentValue) => !currentValue
                    );
                  }}
                >
                  <View>
                    <Text style={styles.subjectProgressTitle}>
                      授業ごとの進捗
                    </Text>
                    <Text style={styles.subjectProgressCount}>
                      {subjectReviewProgress.length}科目
                    </Text>
                  </View>

                  <Text style={styles.subjectProgressToggle}>
                    {showSubjectProgress
                      ? '閉じる ︿'
                      : '開く ﹀'}
                  </Text>
                </Pressable>

                {showSubjectProgress ? (
                  <View style={styles.subjectProgressContent}>
                    <View style={styles.overallProgressCard}>
                      <View style={styles.overallProgressHeading}>
                        <Text style={styles.overallProgressTitle}>
                          全授業の定着度
                        </Text>
                        <Text style={styles.overallProgressPercentage}>
                          {overallLearningCompletion.percentage === null
                            ? '未開始'
                            : `${overallLearningCompletion.percentage}%`}
                        </Text>
                      </View>

                      {overallLearningCompletion.percentage !== null ? (
                        <>
                          <View
                            style={styles.overallProgressBarTrack}
                            accessibilityRole="progressbar"
                            accessibilityValue={{
                              min: 0,
                              max: 100,
                              now: overallLearningCompletion.percentage,
                              text: `全授業の問題・カード定着度${overallLearningCompletion.percentage}%`,
                            }}
                          >
                            <View
                              style={[
                                styles.overallProgressBarFill,
                                {
                                  width: `${overallLearningCompletion.percentage}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.overallProgressDetail}>
                            覚えた{' '}
                            {overallLearningCompletion.knownCount}件・残り{' '}
                            {overallLearningCompletion.remainingCount}件
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.overallProgressEmpty}>
                          練習問題またはカードを作成すると表示されます
                        </Text>
                      )}
                    </View>

                    <View style={styles.subjectProgressSortRow}>
                      <Text style={styles.subjectProgressSortLabel}>
                        並び順
                      </Text>
                      {([
                        ['attention', '要対応順'],
                        ['subject', '授業名順'],
                      ] as const).map(([mode, label]) => {
                        const selected =
                          reviewDisplayOptions
                            .subjectProgressSortMode === mode;

                        return (
                          <Pressable
                            key={mode}
                            style={[
                              styles.subjectProgressSortButton,
                              selected &&
                                styles.subjectProgressSortButtonSelected,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              const updatedOptions = {
                                ...reviewDisplayOptions,
                                subjectProgressSortMode: mode,
                              };

                              setReviewDisplayOptions(updatedOptions);
                              void saveReviewDisplayOptions(
                                updatedOptions
                              ).catch((error) => {
                                console.log(
                                  '復習進捗の並び順保存エラー:',
                                  error
                                );
                              });
                            }}
                          >
                            <Text
                              style={[
                                styles.subjectProgressSortButtonText,
                                selected &&
                                  styles.subjectProgressSortButtonTextSelected,
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.subjectProgressSortRow}>
                      <Text style={styles.subjectProgressSortLabel}>
                        表示
                      </Text>
                      {([
                        ['attention', '要対応のみ'],
                        ['all', 'すべて'],
                      ] as const).map(([mode, label]) => {
                        const selected =
                          reviewDisplayOptions
                            .subjectProgressFilterMode === mode;

                        return (
                          <Pressable
                            key={mode}
                            style={[
                              styles.subjectProgressSortButton,
                              selected &&
                                styles.subjectProgressSortButtonSelected,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              const updatedOptions = {
                                ...reviewDisplayOptions,
                                subjectProgressFilterMode: mode,
                              };

                              setReviewDisplayOptions(updatedOptions);
                              void saveReviewDisplayOptions(
                                updatedOptions
                              ).catch((error) => {
                                console.log(
                                  '復習進捗の表示範囲保存エラー:',
                                  error
                                );
                              });
                            }}
                          >
                            <Text
                              style={[
                                styles.subjectProgressSortButtonText,
                                selected &&
                                  styles.subjectProgressSortButtonTextSelected,
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {sortedSubjectReviewProgress.length === 0 ? (
                      <Text style={styles.subjectProgressCompleteText}>
                        現在、要対応の授業はありません
                      </Text>
                    ) : null}

                    {sortedSubjectReviewProgress.map((progress) => {
                      const learningCompletion =
                        getSubjectLearningCompletion(progress);
                      const practiceItemCount =
                        progress.practiceKnownCount +
                        progress.practiceReviewCount +
                        progress.practiceUnansweredCount;
                      const flashcardItemCount =
                        progress.flashcardKnownCount +
                        progress.flashcardReviewCount +
                        progress.flashcardUnansweredCount;
                      const summaryCount =
                        progress.currentSummaryCount +
                        progress.outdatedSummaryCount;
                      const hasMissingSummary =
                        progress.missingSummaryCount > 0;
                      const hasOutdatedSummary =
                        progress.outdatedSummaryCount > 0;
                      const hasSummaryTasks =
                        hasMissingSummary || hasOutdatedSummary;
                      const canCreatePractice =
                        summaryCount > 0 &&
                        (
                          practiceItemCount === 0 ||
                          progress.practiceIsOutdated
                        );
                      const canCreateFlashcards =
                        summaryCount > 0 &&
                        (
                          flashcardItemCount === 0 ||
                          progress.flashcardsAreOutdated
                        );
                      const hasExamPreparationTask =
                        progress.examPreparationIsMissing ||
                        progress.examPreparationIsOutdated;

                      return (
                        <View
                          key={progress.subject}
                          style={styles.subjectProgressCard}
                        >
                          <View style={styles.subjectProgressHeading}>
                            <Text style={styles.subjectProgressSubject}>
                              {progress.subject}
                            </Text>
                            {learningCompletion.percentage !== null ? (
                              <Text style={styles.subjectProgressPercentage}>
                                定着度{' '}
                                {learningCompletion.percentage}%
                              </Text>
                            ) : null}
                          </View>

                          {learningCompletion.percentage !== null ? (
                            <View
                              style={styles.subjectProgressBarTrack}
                              accessibilityRole="progressbar"
                              accessibilityValue={{
                                min: 0,
                                max: 100,
                                now: learningCompletion.percentage,
                                text: `問題・カード定着度${learningCompletion.percentage}%`,
                              }}
                            >
                              <View
                                style={[
                                  styles.subjectProgressBarFill,
                                  {
                                    width: `${learningCompletion.percentage}%`,
                                  },
                                ]}
                              />
                            </View>
                          ) : (
                            <Text style={styles.subjectProgressNotCreated}>
                              練習問題・カードは未作成です
                            </Text>
                          )}

                        <Text style={styles.subjectProgressKnown}>
                          覚えた：練習問題{' '}
                          {progress.practiceKnownCount}問・カード{' '}
                          {progress.flashcardKnownCount}枚
                        </Text>
                        <Text style={styles.subjectProgressReview}>
                          復習待ち：練習問題{' '}
                          {progress.practiceReviewCount}問・カード{' '}
                          {progress.flashcardReviewCount}枚・重要写真{' '}
                          {progress.importantPhotoCount}枚
                        </Text>
                        <Text style={styles.subjectProgressUnanswered}>
                          未回答：練習問題{' '}
                          {progress.practiceUnansweredCount}問・カード{' '}
                          {progress.flashcardUnansweredCount}枚
                        </Text>
                        <Text style={styles.subjectProgressMemo}>
                          写真メモ：{progress.notedPhotoCount}枚
                        </Text>
                        <Text style={styles.subjectProgressSummary}>
                          授業回まとめ：最新{' '}
                          {progress.currentSummaryCount}回・更新待ち{' '}
                          {progress.outdatedSummaryCount}回・未作成{' '}
                          {progress.missingSummaryCount}回
                        </Text>
                        <Text style={styles.subjectProgressExamPreparation}>
                          試験対策：
                          {progress.examPreparationIsOutdated
                            ? '更新待ち'
                            : progress.examPreparationIsMissing
                              ? '未作成'
                              : summaryCount > 0
                                ? '最新'
                                : '授業回まとめ作成後に利用可能'}
                        </Text>

                        {progress.practiceIsOutdated ||
                        progress.flashcardsAreOutdated ? (
                          <Text style={styles.subjectProgressOutdated}>
                            更新待ち：
                            {[
                              progress.practiceIsOutdated
                                ? '練習問題'
                                : '',
                              progress.flashcardsAreOutdated
                                ? 'カード'
                                : '',
                            ].filter(Boolean).join('・')}
                          </Text>
                        ) : null}

                        {progress.practiceUnansweredCount > 0 ||
                        progress.flashcardUnansweredCount > 0 ||
                        hasSummaryTasks ||
                        canCreatePractice ||
                        canCreateFlashcards ||
                        hasExamPreparationTask ? (
                          <View style={styles.subjectProgressActions}>
                            {hasSummaryTasks ? (
                              <Pressable
                                style={styles.subjectProgressSummaryButton}
                                accessibilityRole="button"
                                onPress={() => {
                                  router.push({
                                    pathname: '/subject/[subject]',
                                    params: {
                                      subject: progress.subject,
                                      from: 'review',
                                    },
                                  });
                                }}
                              >
                                <Text style={styles.subjectProgressSummaryButtonText}>
                                  {hasMissingSummary &&
                                  hasOutdatedSummary
                                    ? 'まとめを作成・更新'
                                    : hasOutdatedSummary
                                      ? 'まとめを更新'
                                      : '未作成のまとめを作る'}
                                </Text>
                              </Pressable>
                            ) : null}

                            {canCreatePractice ? (
                              <Pressable
                                style={styles.subjectProgressActionButton}
                                accessibilityRole="button"
                                onPress={() => {
                                  router.push({
                                    pathname: '/practice/[subject]',
                                    params: {
                                      subject: progress.subject,
                                      from: 'review',
                                    },
                                  });
                                }}
                              >
                                <Text style={styles.subjectProgressActionText}>
                                  {progress.practiceIsOutdated
                                    ? '練習問題を作り直す'
                                    : '練習問題を作る'}
                                </Text>
                              </Pressable>
                            ) : null}

                            {canCreateFlashcards ? (
                              <Pressable
                                style={styles.subjectProgressActionButton}
                                accessibilityRole="button"
                                onPress={() => {
                                  router.push({
                                    pathname: '/flashcards/[subject]',
                                    params: {
                                      subject: progress.subject,
                                      from: 'review',
                                    },
                                  });
                                }}
                              >
                                <Text style={styles.subjectProgressActionText}>
                                  {progress.flashcardsAreOutdated
                                    ? 'カードを作り直す'
                                    : 'カードを作る'}
                                </Text>
                              </Pressable>
                            ) : null}

                            {hasExamPreparationTask ? (
                              <Pressable
                                style={styles.subjectProgressSummaryButton}
                                accessibilityRole="button"
                                onPress={() => {
                                  router.push({
                                    pathname: '/exam-prep/[subject]',
                                    params: {
                                      subject: progress.subject,
                                    },
                                  });
                                }}
                              >
                                <Text style={styles.subjectProgressSummaryButtonText}>
                                  {progress.examPreparationIsOutdated
                                    ? '試験対策を作り直す'
                                    : '試験対策を作る'}
                                </Text>
                              </Pressable>
                            ) : null}

                            {progress.practiceUnansweredCount > 0 ? (
                              <Pressable
                                style={styles.subjectProgressActionButton}
                                accessibilityRole="button"
                                onPress={() => {
                                  router.push({
                                    pathname: '/practice/[subject]',
                                    params: {
                                      subject: progress.subject,
                                      mode: 'unanswered',
                                    },
                                  });
                                }}
                              >
                                <Text style={styles.subjectProgressActionText}>
                                  未回答の問題に挑戦
                                </Text>
                              </Pressable>
                            ) : null}

                            {progress.flashcardUnansweredCount > 0 ? (
                              <Pressable
                                style={styles.subjectProgressActionButton}
                                accessibilityRole="button"
                                onPress={() => {
                                  router.push({
                                    pathname: '/flashcards/[subject]',
                                    params: {
                                      subject: progress.subject,
                                      mode: 'unanswered',
                                    },
                                  });
                                }}
                              >
                                <Text style={styles.subjectProgressActionText}>
                                  未回答のカードに挑戦
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {reviewDisplayOptions.showImportantPhotos &&
            importantPhotos.length > 0 ? (
              <View style={styles.importantPhotoSection}>
                <Pressable
                  style={styles.importantPhotoHeader}
                  accessibilityRole="button"
                  accessibilityLabel={`重要な写真${importantPhotos.length}枚を${showImportantPhotos ? '閉じる' : '開く'}`}
                  accessibilityState={{
                    expanded: showImportantPhotos,
                  }}
                  onPress={() => {
                    setShowImportantPhotos(
                      (currentValue) => !currentValue
                    );
                    setImportantPhotoLimit(photoSearchPageSize);
                  }}
                >
                  <View>
                    <Text style={styles.importantPhotoTitle}>
                      重要な写真
                    </Text>
                    <Text style={styles.importantPhotoCount}>
                      全{importantPhotos.length}枚・未復習{' '}
                      {pendingImportantPhotoCount}枚
                    </Text>
                  </View>

                  <Text style={styles.importantPhotoToggle}>
                    {showImportantPhotos ? '閉じる ︿' : '開く ﹀'}
                  </Text>
                </Pressable>

                {showImportantPhotos ? (
                  <View style={styles.importantPhotoList}>
                    {importantPhotoSubjects.length > 1 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={
                          styles.importantSubjectFilterList
                        }
                      >
                        {[null, ...importantPhotoSubjects].map(
                          (filterSubject) => {
                            const selected =
                              selectedImportantSubject ===
                              filterSubject;
                            const label =
                              filterSubject ?? 'すべて';

                            return (
                              <Pressable
                                key={label}
                                style={[
                                  styles.importantSubjectFilterButton,
                                  selected &&
                                    styles.importantSubjectFilterButtonActive,
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`${label}の重要な写真を表示`}
                                onPress={() => {
                                  setSelectedImportantSubject(
                                    filterSubject
                                  );
                                  setImportantPhotoLimit(
                                    photoSearchPageSize
                                  );
                                }}
                              >
                                <Text
                                  style={[
                                    styles.importantSubjectFilterText,
                                    selected &&
                                      styles.importantSubjectFilterTextActive,
                                  ]}
                                >
                                  {label}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </ScrollView>
                    ) : null}

                    <View style={styles.importantStatusFilterRow}>
                      <Text style={styles.importantStatusFilterLabel}>
                        状態
                      </Text>
                      {([
                        ['pending', '未復習のみ'],
                        ['all', 'すべて'],
                      ] as const).map(([filter, label]) => {
                        const selected =
                          importantReviewFilter === filter;

                        return (
                          <Pressable
                            key={filter}
                            style={[
                              styles.importantStatusFilterButton,
                              selected &&
                                styles.importantStatusFilterButtonActive,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              setImportantReviewFilter(filter);
                              setImportantPhotoLimit(
                                photoSearchPageSize
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.importantStatusFilterText,
                                selected &&
                                  styles.importantStatusFilterTextActive,
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {selectedImportantSubject !== null ||
                    importantReviewFilter === 'pending' ? (
                      <Text style={styles.importantFilteredCount}>
                        {filteredImportantPhotos.length}枚
                      </Text>
                    ) : null}

                    {filteredImportantPhotos.length === 0 ? (
                      <Text style={styles.importantPhotoEmptyText}>
                        未復習の重要写真はありません
                      </Text>
                    ) : null}

                    {visibleImportantPhotos.map((photo) => (
                      <Pressable
                        key={photo.id}
                        style={styles.importantPhotoCard}
                        accessibilityRole="button"
                        accessibilityLabel={`${getPhotoLabel(photo)}の重要な写真を開く`}
                        onPress={() => {
                          router.push({
                            pathname: '/photo/[id]',
                            params: {
                              id: photo.id,
                              mode: 'important',
                              importantSubject:
                                selectedImportantSubject ?? '',
                              ...(importantReviewFilter === 'pending'
                                ? { importantStatus: 'pending' }
                                : {}),
                            },
                          });
                        }}
                      >
                        <Image
                          style={styles.photoSearchThumbnail}
                          source={{ uri: photo.uri }}
                        />

                        <View style={styles.photoSearchText}>
                          <View style={styles.importantPhotoSubjectRow}>
                            <Text style={styles.importantPhotoSubject}>
                              {getPhotoLabel(photo)}
                            </Text>
                            <Text
                              style={[
                                styles.importantReviewStatusBadge,
                                photo.importantReviewedAt !== undefined &&
                                  styles.importantReviewStatusBadgeCompleted,
                              ]}
                            >
                              {photo.importantReviewedAt === undefined
                                ? '未復習'
                                : '復習済み'}
                            </Text>
                          </View>
                          <Text style={styles.photoSearchDate}>
                            {getPhotoDateLabel(photo.takenAt)}
                          </Text>
                          <Text style={styles.importantPreviewSource}>
                            {photo.note !== undefined &&
                            photo.note.trim() !== ''
                              ? 'メモ'
                              : '認識文字'}
                          </Text>
                          <Text
                            style={styles.photoSearchPreview}
                            numberOfLines={2}
                          >
                            {photo.note !== undefined &&
                            photo.note.trim() !== ''
                              ? photo.note
                              : photoOcrRecords[photo.id]?.text ??
                                '文字認識結果なし'}
                          </Text>
                        </View>

                        <Text style={styles.importantPhotoOpenText}>
                          ›
                        </Text>
                      </Pressable>
                    ))}

                    {hasMoreImportantPhotos ? (
                      <Pressable
                        style={styles.importantPhotoMoreButton}
                        accessibilityRole="button"
                        accessibilityLabel="重要な写真をさらに表示"
                        onPress={() => {
                          setImportantPhotoLimit(
                            (currentLimit) =>
                              currentLimit + photoSearchPageSize
                          );
                        }}
                      >
                        <Text
                          style={styles.importantPhotoMoreButtonText}
                        >
                          さらに表示
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {reviewDisplayOptions.showPhotoNotes &&
            notedPhotos.length > 0 ? (
              <View style={styles.notedPhotoSection}>
                <Pressable
                  style={styles.importantPhotoHeader}
                  accessibilityRole="button"
                  accessibilityLabel={`メモ付き写真${notedPhotos.length}枚を${showNotedPhotos ? '閉じる' : '開く'}`}
                  accessibilityState={{
                    expanded: showNotedPhotos,
                  }}
                  onPress={() => {
                    setShowNotedPhotos(
                      (currentValue) => !currentValue
                    );
                    setNotedPhotoLimit(photoSearchPageSize);
                  }}
                >
                  <View>
                    <Text style={styles.notedPhotoTitle}>
                      写真メモ
                    </Text>
                    <Text style={styles.notedPhotoCount}>
                      {notedPhotos.length}枚
                    </Text>
                  </View>

                  <Text style={styles.notedPhotoToggle}>
                    {showNotedPhotos ? '閉じる ︿' : '開く ﹀'}
                  </Text>
                </Pressable>

                {showNotedPhotos ? (
                  <View style={styles.notedPhotoList}>
                    {notedPhotoSubjects.length > 1 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={
                          styles.importantSubjectFilterList
                        }
                      >
                        {[null, ...notedPhotoSubjects].map(
                          (filterSubject) => {
                            const selected =
                              selectedNotedSubject ===
                              filterSubject;
                            const label =
                              filterSubject ?? 'すべて';

                            return (
                              <Pressable
                                key={label}
                                style={[
                                  styles.notedSubjectFilterButton,
                                  selected &&
                                    styles.notedSubjectFilterButtonActive,
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`${label}のメモ付き写真を表示`}
                                onPress={() => {
                                  setSelectedNotedSubject(
                                    filterSubject
                                  );
                                  setNotedPhotoLimit(
                                    photoSearchPageSize
                                  );
                                }}
                              >
                                <Text
                                  style={[
                                    styles.notedSubjectFilterText,
                                    selected &&
                                      styles.notedSubjectFilterTextActive,
                                  ]}
                                >
                                  {label}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </ScrollView>
                    ) : null}

                    {selectedNotedSubject !== null ? (
                      <Text style={styles.notedFilteredCount}>
                        {filteredNotedPhotos.length}枚
                      </Text>
                    ) : null}

                    {visibleNotedPhotos.map((photo) => (
                      <Pressable
                        key={photo.id}
                        style={styles.notedPhotoCard}
                        accessibilityRole="button"
                        accessibilityLabel={`${getPhotoLabel(photo)}のメモ付き写真を開く`}
                        onPress={() => {
                          router.push({
                            pathname: '/photo/[id]',
                            params: {
                              id: photo.id,
                              mode: 'noted',
                              notedSubject:
                                selectedNotedSubject ?? '',
                            },
                          });
                        }}
                      >
                        <Image
                          style={styles.photoSearchThumbnail}
                          source={{ uri: photo.uri }}
                        />

                        <View style={styles.photoSearchText}>
                          <Text style={styles.notedPhotoSubject}>
                            {getPhotoLabel(photo)}
                          </Text>
                          <Text style={styles.photoSearchDate}>
                            {getPhotoDateLabel(photo.takenAt)}
                          </Text>
                          <Text
                            style={styles.photoSearchPreview}
                            numberOfLines={3}
                          >
                            {photo.note}
                          </Text>
                        </View>

                        <Text style={styles.notedPhotoOpenText}>
                          ›
                        </Text>
                      </Pressable>
                    ))}

                    {hasMoreNotedPhotos ? (
                      <Pressable
                        style={styles.notedPhotoMoreButton}
                        accessibilityRole="button"
                        accessibilityLabel="メモ付き写真をさらに表示"
                        onPress={() => {
                          setNotedPhotoLimit(
                            (currentLimit) =>
                              currentLimit + photoSearchPageSize
                          );
                        }}
                      >
                        <Text
                          style={styles.notedPhotoMoreButtonText}
                        >
                          さらに表示
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.dayFilterContainer}>
              {reviewDays.map((day) => {
                const selected = selectedReviewDay === day;

                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.dayFilterButton,
                      selected && styles.dayFilterButtonActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      day === 'すべて'
                        ? 'すべての曜日を表示'
                        : `${day}曜日の授業を表示`
                    }
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setSelectedReviewDay(day);
                      setSelectedLectureSubject(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayFilterButtonText,
                        selected &&
                          styles.dayFilterButtonTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={styles.modeSelector}
              accessibilityRole="tablist"
            >
              <Pressable
                style={[
                  styles.modeButton,
                  reviewMode === 'subject' &&
                    styles.modeButtonActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: reviewMode === 'subject',
                }}
                onPress={() => selectReviewMode('subject')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    reviewMode === 'subject' &&
                      styles.modeButtonTextActive,
                  ]}
                >
                  授業全体
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeButton,
                  reviewMode === 'lecture' &&
                    styles.modeButtonActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: reviewMode === 'lecture',
                }}
                onPress={() => {
                  setSelectedLectureSubject(null);
                  selectReviewMode('lecture');
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    reviewMode === 'lecture' &&
                      styles.modeButtonTextActive,
                  ]}
                >
                  授業回ごと
                </Text>
              </Pressable>
            </View>

            <ScrollView
              ref={reviewPagerRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              directionalLockEnabled
              scrollEnabled={selectedLectureSubject === null}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const pageIndex = Math.round(
                  event.nativeEvent.contentOffset.x /
                    reviewPageWidth
                );

                setReviewMode(
                  pageIndex === 0 ? 'subject' : 'lecture'
                );
              }}
            >
              <View style={{ width: reviewPageWidth }}>
                <Text style={styles.sectionTitle}>
                  授業全体のまとめ
                </Text>

                <Text style={styles.sectionDescription}>
                  保存済みの授業回まとめから、科目全体の試験対策を表示します。
                </Text>

                <View style={styles.examList}>
                  {filteredExamSubjectGroups.map(
                    ([groupSubject, subjectSummaries]) => {
                      const savedExamPreparation =
                        examPreparationRecords[
                          createExamPreparationRecordId(
                            groupSubject
                          )
                        ];
                      const hasSavedExamPreparation =
                        savedExamPreparation !== undefined;
                      const examPreparationIsCurrent =
                        savedExamPreparation !== undefined &&
                        savedExamPreparation.sourceSummarySignature ===
                          createExamPreparationSourceSignature(
                            subjectSummaries
                          );
                      const savedPracticeQuestions =
                        practiceQuestionRecords[
                          createPracticeQuestionRecordId(
                            groupSubject
                          )
                        ];
                      const hasSavedPracticeQuestions =
                        savedPracticeQuestions !== undefined;
                      const practiceIsCurrent =
                        savedPracticeQuestions !== undefined &&
                        savedPracticeQuestions.sourceSummarySignature ===
                          createPracticeQuestionSourceSignature(
                            subjectSummaries
                          );
                      const practiceKnownCount = practiceIsCurrent
                        ? Object.values(
                            savedPracticeQuestions.assessments ?? {}
                          ).filter(
                            (assessment) => assessment === 'known'
                          ).length
                        : 0;
                      const practiceReviewCount = practiceIsCurrent
                        ? Object.values(
                            savedPracticeQuestions.assessments ?? {}
                          ).filter(
                            (assessment) => assessment === 'review'
                          ).length
                        : 0;
                      const savedFlashcards = flashcardRecords[
                        createFlashcardRecordId(groupSubject)
                      ];
                      const hasSavedFlashcards =
                        savedFlashcards !== undefined;
                      const flashcardsAreCurrent =
                        savedFlashcards !== undefined &&
                        savedFlashcards.sourceSummarySignature ===
                          createFlashcardSourceSignature(
                            subjectSummaries
                          );
                      const flashcardKnownCount = flashcardsAreCurrent
                        ? Object.values(
                            savedFlashcards.assessments ?? {}
                          ).filter(
                            (assessment) => assessment === 'known'
                          ).length
                        : 0;
                      const flashcardReviewCount = flashcardsAreCurrent
                        ? Object.values(
                            savedFlashcards.assessments ?? {}
                          ).filter(
                            (assessment) => assessment === 'review'
                          ).length
                        : 0;

                      return (
                        <Pressable
                          key={groupSubject}
                          style={styles.examCard}
                          accessibilityRole="button"
                          accessibilityLabel={`${groupSubject}の授業全体まとめを開く、${subjectSummaries.length === 0 ? '授業回まとめ未作成' : examPreparationIsCurrent ? '保存済み' : hasSavedExamPreparation ? 'まとめ更新あり' : '未作成'}`}
                          onPress={() => {
                            if (subjectSummaries.length === 0) {
                              router.push({
                                pathname: '/subject/[subject]',
                                params: {
                                  subject: groupSubject,
                                  from: 'review',
                                },
                              });
                              return;
                            }

                            router.push({
                              pathname: '/exam-prep/[subject]',
                              params: { subject: groupSubject },
                            });
                          }}
                        >
                          <View style={styles.examCardText}>
                            <Text style={styles.examSubject}>
                              {groupSubject}
                            </Text>

                            {getSubjectScheduleLabel(
                              groupSubject
                            ) !== '' ? (
                              <Text style={styles.subjectSchedule}>
                                {getSubjectScheduleLabel(
                                  groupSubject
                                )}
                              </Text>
                            ) : null}

                            <Text style={styles.examCount}>
                              {subjectSummaries.length > 0
                                ? `${subjectSummaries.length}回分のまとめ`
                                : `${getSubjectPhotoLectureCount(groupSubject)}回分の写真・まとめ未作成`}
                            </Text>

                            <Text
                              style={[
                                styles.examStatus,
                                subjectSummaries.length === 0
                                  ? styles.examStatusNotCreated
                                  : examPreparationIsCurrent
                                  ? styles.examStatusSaved
                                  : hasSavedExamPreparation
                                    ? styles.examStatusOutdated
                                    : styles.examStatusNotCreated,
                              ]}
                            >
                              {subjectSummaries.length === 0
                                ? '授業回まとめ未作成'
                                : examPreparationIsCurrent
                                ? '保存済み'
                                : hasSavedExamPreparation
                                  ? 'まとめ更新あり'
                                  : '未作成'}
                            </Text>

                            <Text style={styles.learningProgress}>
                              {practiceIsCurrent
                                ? `練習問題：覚えた ${practiceKnownCount}/${savedPracticeQuestions.questions.length}問・あとで復習 ${practiceReviewCount}問`
                                : hasSavedPracticeQuestions
                                  ? '練習問題：まとめ更新あり'
                                  : '練習問題：未作成'}
                            </Text>

                            <Text style={styles.learningProgress}>
                              {flashcardsAreCurrent
                                ? `カード：覚えた ${flashcardKnownCount}/${savedFlashcards.cards.length}枚・あとで復習 ${flashcardReviewCount}枚`
                                : hasSavedFlashcards
                                  ? 'カード：まとめ更新あり'
                                  : 'カード：未作成'}
                            </Text>
                          </View>

                          <Text style={styles.examOpenText}>
                            {subjectSummaries.length === 0
                              ? 'まとめを作成 ›'
                              : hasSavedExamPreparation
                              ? '保存済みを見る ›'
                              : '作成する ›'}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>

                {filteredExamSubjectGroups.length === 0 ? (
                  <Text style={styles.noSearchResults}>
                    検索結果がありません
                  </Text>
                ) : null}
              </View>

              <View style={{ width: reviewPageWidth }}>
                {selectedLectureSubject === null ? (
                  <>
                    <Text style={styles.sectionTitle}>
                      授業を選択
                    </Text>

                    <Text style={styles.sectionDescription}>
                      授業を選んで、回ごとのまとめを表示します。
                    </Text>

                    <View style={styles.summaryList}>
                      {filteredSubjectGroups.map(
                        ([groupSubject, subjectSummaries]) => (
                          <Pressable
                            key={groupSubject}
                            style={styles.lectureSubjectCard}
                            accessibilityRole="button"
                            accessibilityLabel={`${groupSubject}、${subjectSummaries.length}回分のまとめ`}
                            onPress={() =>
                              setSelectedLectureSubject(
                                groupSubject
                              )
                            }
                          >
                            <View style={styles.lectureSubjectText}>
                              <Text style={styles.subjectName}>
                                {groupSubject}
                              </Text>

                              {getSubjectScheduleLabel(
                                groupSubject
                              ) !== '' ? (
                                <Text style={styles.subjectSchedule}>
                                  {getSubjectScheduleLabel(
                                    groupSubject
                                  )}
                                </Text>
                              ) : null}

                              <Text style={styles.lectureCount}>
                                {subjectSummaries.length > 0
                                  ? `${subjectSummaries.length}回分のまとめ`
                                  : `${getSubjectPhotoLectureCount(groupSubject)}回分の写真・まとめ未作成`}
                              </Text>
                            </View>

                            <Text style={styles.openTextInline}>
                              {subjectSummaries.length > 0
                                ? '授業回を見る ›'
                                : 'まとめを作成 ›'}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>

                    {filteredSubjectGroups.length === 0 ? (
                      <Text style={styles.noSearchResults}>
                        検索結果がありません
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Animated.View
                    style={{
                      transform: [
                        { translateX: lectureSwipeX },
                      ],
                    }}
                  >
                    <Pressable
                      style={styles.subjectBackButton}
                      accessibilityRole="button"
                      accessibilityLabel="授業選択に戻る"
                      hitSlop={10}
                      onPress={() =>
                        setSelectedLectureSubject(null)
                      }
                    >
                      <Text style={styles.subjectBackButtonText}>
                        ‹ 授業を選び直す
                      </Text>
                    </Pressable>

                    <Text style={styles.sectionTitle}>
                      {selectedLectureSubject}
                    </Text>

                    <Text style={styles.sectionDescription}>
                      見たい授業回を選択してください。
                    </Text>

                    <Pressable
                      style={styles.createSummaryButton}
                      accessibilityRole="button"
                      accessibilityLabel={`${selectedLectureSubject}の授業回まとめを作成または更新`}
                      onPress={() => {
                        router.push({
                          pathname: '/subject/[subject]',
                          params: {
                            subject: selectedLectureSubject,
                          },
                        });
                      }}
                    >
                      <Text style={styles.createSummaryButtonText}>
                        授業回のまとめを作成・更新
                      </Text>
                    </Pressable>

                    <View style={styles.summaryList}>
                      {selectedSubjectSummaries.map(
                        (summary) => {
                          const lectureNumber =
                            selectedSubjectAllSummaries.findIndex(
                              (candidate) =>
                                candidate.id === summary.id
                            ) + 1;

                          return (
                            <Pressable
                              key={summary.id}
                              style={styles.summaryCard}
                              accessibilityRole="button"
                              accessibilityLabel={`${selectedLectureSubject}第${lectureNumber}回のまとめを開く`}
                              onPress={() => openSummary(summary)}
                            >
                              <View style={styles.cardHeader}>
                                <Text style={styles.subjectName}>
                                  第{lectureNumber}回
                                </Text>

                                <Text style={styles.dateText}>
                                  {getDateLabel(summary.dateKey)}
                                </Text>
                              </View>

                              <Text
                                style={styles.summaryPreview}
                                numberOfLines={2}
                              >
                                {summary.text}
                              </Text>

                              <Text style={styles.openText}>
                                まとめを開く ›
                              </Text>
                            </Pressable>
                          );
                        }
                      )}
                    </View>

                    {selectedSubjectSummaries.length === 0 ? (
                      <Text style={styles.noSearchResults}>
                        {normalizedSearchQuery === ''
                          ? 'まだまとめがありません'
                          : 'この授業内に検索結果がありません'}
                      </Text>
                    ) : null}
                  </Animated.View>
                )}
              </View>
            </ScrollView>
          </>
        )}
      </ScrollView>

      <Modal
        visible={selectedSummary !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSummary}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedSummary?.subject}
            </Text>

            {selectedSummaryLectureNumber !== null &&
            selectedSummaryLectureNumber >= 0 ? (
              <Text style={styles.modalProgress}>
                第{selectedSummaryLectureNumber + 1}回 / 全
                {selectedSubjectAllSummaries.length}回
              </Text>
            ) : null}

            <Text style={styles.modalDate}>
              {selectedSummary === null
                ? ''
                : getDateLabel(selectedSummary.dateKey)}
            </Text>

            {isEditingSummary ? (
              <>
                <TextInput
                  style={styles.summaryEditInput}
                  defaultValue={editedSummaryTextRef.current}
                  onChangeText={(text) => {
                    editedSummaryTextRef.current = text;
                  }}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  accessibilityLabel="授業まとめ本文"
                />

                {summaryEditError !== '' ? (
                  <Text style={styles.summaryEditError}>
                    {summaryEditError}
                  </Text>
                ) : null}

                <Pressable
                  style={[
                    styles.saveSummaryButton,
                    isSavingSummary && styles.disabledButton,
                  ]}
                  disabled={isSavingSummary}
                  onPress={() => void saveEditedSummary()}
                >
                  <Text style={styles.saveSummaryButtonText}>
                    {isSavingSummary ? '保存中...' : '変更を保存'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.cancelEditButton}
                  disabled={isSavingSummary}
                  onPress={() => {
                    editedSummaryTextRef.current =
                      selectedSummary?.text ?? '';
                    setIsEditingSummary(false);
                    setSummaryEditError('');
                  }}
                >
                  <Text style={styles.cancelEditButtonText}>
                    キャンセル
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <GestureDetector gesture={summarySwipeGesture}>
                  <ScrollView
                    key={selectedSummary?.id}
                    style={styles.modalScrollView}
                    directionalLockEnabled
                  >
                    <LectureSummaryReviewPoints
                      summaryText={selectedSummary?.text ?? ''}
                    />

                    <Text
                      style={styles.modalSummaryText}
                      selectable
                    >
                      {selectedSummary?.text}
                    </Text>
                  </ScrollView>
                </GestureDetector>

                <View style={styles.summaryNavigationRow}>
                  <Pressable
                    style={[
                      styles.summaryNavigationButton,
                      (
                        selectedSummaryLectureNumber === null ||
                        selectedSummaryLectureNumber <= 0
                      ) && styles.disabledButton,
                    ]}
                    disabled={
                      selectedSummaryLectureNumber === null ||
                      selectedSummaryLectureNumber <= 0 ||
                      isDeletingSummary
                    }
                    accessibilityRole="button"
                    accessibilityLabel="前の授業回のまとめを開く"
                    onPress={() => openAdjacentSummary(-1)}
                  >
                    <Text style={styles.summaryNavigationButtonText}>
                      ‹ 前の回
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.summaryNavigationButton,
                      (
                        selectedSummaryLectureNumber === null ||
                        selectedSummaryLectureNumber >=
                          selectedSubjectAllSummaries.length - 1
                      ) && styles.disabledButton,
                    ]}
                    disabled={
                      selectedSummaryLectureNumber === null ||
                      selectedSummaryLectureNumber >=
                        selectedSubjectAllSummaries.length - 1 ||
                      isDeletingSummary
                    }
                    accessibilityRole="button"
                    accessibilityLabel="次の授業回のまとめを開く"
                    onPress={() => openAdjacentSummary(1)}
                  >
                    <Text style={styles.summaryNavigationButtonText}>
                      次の回 ›
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.editSummaryButton}
                  disabled={isDeletingSummary}
                  accessibilityRole="button"
                  accessibilityLabel="この授業まとめを編集"
                  onPress={() => {
                    editedSummaryTextRef.current =
                      selectedSummary?.text ?? '';
                    setIsEditingSummary(true);
                    setSummaryEditError('');
                  }}
                >
                  <Text style={styles.editSummaryButtonText}>
                    このまとめを編集
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.shareSummaryButton}
                  disabled={isDeletingSummary}
                  accessibilityRole="button"
                  accessibilityLabel="この授業まとめを共有"
                  onPress={() => void shareSelectedSummary()}
                >
                  <Text style={styles.shareSummaryButtonText}>
                    このまとめを共有
                  </Text>
                </Pressable>

                {summaryDeleteError !== '' ? (
                  <Text style={styles.summaryDeleteError}>
                    {summaryDeleteError}
                  </Text>
                ) : null}

                <Pressable
                  style={[
                    styles.deleteSummaryButton,
                    isDeletingSummary && styles.disabledButton,
                  ]}
                  disabled={isDeletingSummary}
                  accessibilityRole="button"
                  accessibilityLabel="この授業まとめを削除"
                  onPress={confirmDeleteSelectedSummary}
                >
                  <Text style={styles.deleteSummaryButtonText}>
                    {isDeletingSummary
                      ? '削除中...'
                      : 'このまとめを削除'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.closeButton}
                  disabled={isDeletingSummary}
                  onPress={closeSummary}
                >
                  <Text style={styles.closeButtonText}>
                    閉じる
                  </Text>
                </Pressable>
              </>
            )}
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

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    color: '#111',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
  },

  subtitle: {
    color: '#555',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 8,
  },

  academicTermButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef2fb',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 18,
  },

  academicTermText: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
  },

  academicTermArrow: {
    color: '#5670a8',
    fontSize: 12,
    fontWeight: 'bold',
  },

  searchContainer: {
    marginBottom: 14,
  },

  searchInput: {
    color: '#222',
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderRadius: 10,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  photoSearchSection: {
    marginBottom: 18,
  },

  photoSearchTitle: {
    color: '#222',
    fontSize: 16,
    fontWeight: 'bold',
  },

  photoSearchList: {
    gap: 9,
    marginTop: 9,
  },

  photoSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f3fb',
    borderWidth: 1,
    borderColor: '#cbb8dd',
    borderRadius: 11,
    padding: 10,
  },

  photoSearchThumbnail: {
    width: 68,
    height: 68,
    backgroundColor: '#e5e5e5',
    borderRadius: 7,
  },

  photoSearchText: {
    flex: 1,
    marginLeft: 11,
  },

  photoSearchSubject: {
    color: '#563475',
    fontSize: 14,
    fontWeight: 'bold',
  },

  photoSearchDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },

  photoSearchSource: {
    color: '#765294',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 3,
  },

  photoSearchPreview: {
    color: '#333',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },

  photoSearchOpenText: {
    color: '#6b3ca0',
    fontSize: 24,
    marginLeft: 8,
  },

  photoSearchEmptyText: {
    color: '#777',
    fontSize: 13,
    marginTop: 8,
  },

  photoSearchMoreButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#9d7dbc',
    borderRadius: 9,
    paddingVertical: 10,
  },

  photoSearchMoreButtonText: {
    color: '#6b3ca0',
    fontSize: 13,
    fontWeight: 'bold',
  },

  reviewQueueSection: {
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#ddc27b',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },

  reviewDashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  reviewQueueTitle: {
    color: '#614914',
    fontSize: 16,
    fontWeight: 'bold',
  },

  reviewQueueCount: {
    color: '#846a2b',
    fontSize: 12,
    marginTop: 2,
  },

  reviewQueueToggle: {
    color: '#715719',
    fontSize: 14,
    fontWeight: 'bold',
  },

  reviewQueueContent: {
    borderTopWidth: 1,
    borderTopColor: '#ead9aa',
    gap: 9,
    padding: 10,
  },

  reviewQueueEmptyText: {
    color: '#716443',
    fontSize: 13,
    paddingVertical: 4,
    textAlign: 'center',
  },

  reviewQueueCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dfca90',
    borderRadius: 10,
    padding: 11,
  },

  reviewQueueSubject: {
    color: '#332b19',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },

  reviewQueueSubjectRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  reviewQueueSubjectCount: {
    color: '#7d6b3e',
    fontSize: 12,
    fontWeight: 'bold',
  },

  reviewQueueActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 9,
  },

  reviewQueueActionButton: {
    backgroundColor: '#fff2cf',
    borderWidth: 1,
    borderColor: '#d8b660',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  reviewQueueActionText: {
    color: '#6e5418',
    fontSize: 12,
    fontWeight: 'bold',
  },

  reviewQueueUnansweredButton: {
    backgroundColor: '#eef2fb',
    borderColor: '#9dadcf',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  reviewQueueUnansweredText: {
    color: '#405b91',
    fontSize: 12,
    fontWeight: 'bold',
  },

  reviewQueueUpdateButton: {
    backgroundColor: '#fff0d9',
    borderColor: '#d99a43',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  reviewQueueUpdateText: {
    color: '#8a5511',
    fontSize: 12,
    fontWeight: 'bold',
  },

  reviewQueuePhotoButton: {
    backgroundColor: '#f8edcc',
    borderWidth: 1,
    borderColor: '#b58a2d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  reviewQueuePhotoText: {
    color: '#725313',
    fontSize: 12,
    fontWeight: 'bold',
  },

  subjectProgressSection: {
    backgroundColor: '#f2f5fc',
    borderWidth: 1,
    borderColor: '#c9d3e8',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },

  subjectProgressTitle: {
    color: '#263b68',
    fontSize: 16,
    fontWeight: 'bold',
  },

  subjectProgressCount: {
    color: '#60739c',
    fontSize: 12,
    marginTop: 2,
  },

  subjectProgressToggle: {
    color: '#405b91',
    fontSize: 14,
    fontWeight: 'bold',
  },

  subjectProgressContent: {
    borderTopWidth: 1,
    borderTopColor: '#d8dfed',
    gap: 9,
    padding: 10,
  },

  overallProgressCard: {
    backgroundColor: '#263b68',
    borderRadius: 10,
    padding: 13,
  },

  overallProgressHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  overallProgressTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },

  overallProgressPercentage: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  overallProgressBarTrack: {
    backgroundColor: '#67789d',
    borderRadius: 4,
    height: 8,
    marginTop: 11,
    overflow: 'hidden',
  },

  overallProgressBarFill: {
    backgroundColor: '#b9d0ff',
    borderRadius: 4,
    height: '100%',
  },

  overallProgressDetail: {
    color: '#e7edfa',
    fontSize: 12,
    marginTop: 8,
  },

  overallProgressEmpty: {
    color: '#e7edfa',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  subjectProgressSortRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  subjectProgressSortLabel: {
    color: '#596579',
    fontSize: 12,
    marginRight: 2,
  },

  subjectProgressSortButton: {
    backgroundColor: 'white',
    borderColor: '#c4cde0',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  subjectProgressSortButtonSelected: {
    backgroundColor: '#31518f',
    borderColor: '#31518f',
  },

  subjectProgressSortButtonText: {
    color: '#52617d',
    fontSize: 12,
    fontWeight: 'bold',
  },

  subjectProgressSortButtonTextSelected: {
    color: 'white',
  },

  subjectProgressCompleteText: {
    color: '#3b6d50',
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 4,
    paddingVertical: 8,
    textAlign: 'center',
  },

  subjectProgressCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d4dbea',
    borderRadius: 10,
    padding: 11,
  },

  subjectProgressSubject: {
    color: '#202b43',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 7,
  },

  subjectProgressHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  subjectProgressPercentage: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
  },

  subjectProgressBarTrack: {
    backgroundColor: '#e2e7f1',
    borderRadius: 4,
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
  },

  subjectProgressBarFill: {
    backgroundColor: '#31518f',
    borderRadius: 4,
    height: '100%',
  },

  subjectProgressNotCreated: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },

  subjectProgressKnown: {
    color: '#28794c',
    fontSize: 12,
    lineHeight: 18,
  },

  subjectProgressReview: {
    color: '#8a6518',
    fontSize: 12,
    lineHeight: 18,
  },

  subjectProgressUnanswered: {
    color: '#596579',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },

  subjectProgressMemo: {
    color: '#505b98',
    fontSize: 12,
    lineHeight: 18,
  },

  subjectProgressSummary: {
    color: '#52617d',
    fontSize: 12,
    lineHeight: 18,
  },

  subjectProgressExamPreparation: {
    color: '#52617d',
    fontSize: 12,
    lineHeight: 18,
  },

  subjectProgressOutdated: {
    color: '#a05f18',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 18,
    marginTop: 4,
  },

  subjectProgressActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },

  subjectProgressActionButton: {
    backgroundColor: '#edf2ff',
    borderColor: '#9eb0dc',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  subjectProgressSummaryButton: {
    backgroundColor: '#fff4d8',
    borderColor: '#d2ad51',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  subjectProgressSummaryButtonText: {
    color: '#735716',
    fontSize: 12,
    fontWeight: 'bold',
  },

  subjectProgressActionText: {
    color: '#31518f',
    fontSize: 12,
    fontWeight: 'bold',
  },

  importantPhotoSection: {
    backgroundColor: '#fff9e9',
    borderWidth: 1,
    borderColor: '#d8bd74',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },

  importantPhotoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  importantPhotoTitle: {
    color: '#614914',
    fontSize: 16,
    fontWeight: 'bold',
  },

  importantPhotoCount: {
    color: '#846a2b',
    fontSize: 12,
    marginTop: 2,
  },

  importantPhotoToggle: {
    color: '#715719',
    fontSize: 14,
    fontWeight: 'bold',
  },

  importantPhotoList: {
    borderTopWidth: 1,
    borderTopColor: '#ead9aa',
    gap: 9,
    padding: 10,
  },

  importantSubjectFilterList: {
    gap: 7,
    paddingBottom: 2,
  },

  importantSubjectFilterButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#cfb86f',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  importantSubjectFilterButtonActive: {
    backgroundColor: '#8a6818',
    borderColor: '#8a6818',
  },

  importantSubjectFilterText: {
    color: '#715719',
    fontSize: 13,
    fontWeight: 'bold',
  },

  importantSubjectFilterTextActive: {
    color: 'white',
  },

  importantFilteredCount: {
    color: '#846a2b',
    fontSize: 12,
  },

  importantStatusFilterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  importantStatusFilterLabel: {
    color: '#846a2b',
    fontSize: 12,
    marginRight: 2,
  },

  importantStatusFilterButton: {
    backgroundColor: 'white',
    borderColor: '#cfb86f',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  importantStatusFilterButtonActive: {
    backgroundColor: '#8a6818',
    borderColor: '#8a6818',
  },

  importantStatusFilterText: {
    color: '#715719',
    fontSize: 12,
    fontWeight: 'bold',
  },

  importantStatusFilterTextActive: {
    color: 'white',
  },

  importantPhotoEmptyText: {
    color: '#6c5a30',
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 8,
    textAlign: 'center',
  },

  importantPhotoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dbc27c',
    borderRadius: 10,
    padding: 9,
  },

  importantPhotoSubject: {
    color: '#715719',
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
  },

  importantPhotoSubjectRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  importantReviewStatusBadge: {
    backgroundColor: '#fff0c5',
    borderRadius: 999,
    color: '#755615',
    fontSize: 10,
    fontWeight: 'bold',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  importantReviewStatusBadgeCompleted: {
    backgroundColor: '#e1f1e7',
    color: '#2d6a44',
  },

  importantPreviewSource: {
    color: '#8a6818',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 3,
  },

  importantPhotoOpenText: {
    color: '#8a6818',
    fontSize: 24,
    marginLeft: 8,
  },

  importantPhotoMoreButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#c5a34c',
    borderRadius: 9,
    paddingVertical: 10,
  },

  importantPhotoMoreButtonText: {
    color: '#715719',
    fontSize: 13,
    fontWeight: 'bold',
  },

  notedPhotoSection: {
    backgroundColor: '#f3f4ff',
    borderWidth: 1,
    borderColor: '#aeb4dc',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },

  notedPhotoTitle: {
    color: '#384277',
    fontSize: 16,
    fontWeight: 'bold',
  },

  notedPhotoCount: {
    color: '#6872a5',
    fontSize: 12,
    marginTop: 2,
  },

  notedPhotoToggle: {
    color: '#505b98',
    fontSize: 14,
    fontWeight: 'bold',
  },

  notedPhotoList: {
    borderTopWidth: 1,
    borderTopColor: '#d2d6ed',
    gap: 9,
    padding: 10,
  },

  notedSubjectFilterButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#aeb4dc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  notedSubjectFilterButtonActive: {
    backgroundColor: '#505b98',
    borderColor: '#505b98',
  },

  notedSubjectFilterText: {
    color: '#505b98',
    fontSize: 13,
    fontWeight: 'bold',
  },

  notedSubjectFilterTextActive: {
    color: 'white',
  },

  notedFilteredCount: {
    color: '#6872a5',
    fontSize: 12,
  },

  notedPhotoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#bfc4e4',
    borderRadius: 10,
    padding: 9,
  },

  notedPhotoSubject: {
    color: '#384277',
    fontSize: 14,
    fontWeight: 'bold',
  },

  notedPhotoOpenText: {
    color: '#505b98',
    fontSize: 24,
    marginLeft: 8,
  },

  notedPhotoMoreButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#9ca4d2',
    borderRadius: 9,
    paddingVertical: 10,
  },

  notedPhotoMoreButtonText: {
    color: '#505b98',
    fontSize: 13,
    fontWeight: 'bold',
  },

  dayFilterContainer: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 14,
  },

  dayFilterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    backgroundColor: '#f2f4f8',
    borderWidth: 1,
    borderColor: '#d5d9e2',
    borderRadius: 8,
    paddingHorizontal: 2,
  },

  dayFilterButtonActive: {
    backgroundColor: '#31518f',
    borderColor: '#31518f',
  },

  dayFilterButtonText: {
    color: '#555',
    fontSize: 13,
    fontWeight: 'bold',
  },

  dayFilterButtonTextActive: {
    color: 'white',
  },

  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#ededed',
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },

  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
  },

  modeButtonActive: {
    backgroundColor: 'white',
  },

  modeButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },

  modeButtonTextActive: {
    color: '#31518f',
  },

  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#f5f6f8',
    borderRadius: 12,
    padding: 28,
  },

  loadingText: {
    color: '#555',
    fontSize: 14,
    marginTop: 12,
  },

  emptyBox: {
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    padding: 18,
  },

  emptyTitle: {
    color: '#222',
    fontSize: 16,
    fontWeight: 'bold',
  },

  emptyText: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  noSearchResults: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },

  summaryList: {
    gap: 12,
    marginTop: 12,
  },

  sectionTitle: {
    color: '#222',
    fontSize: 20,
    fontWeight: 'bold',
  },

  sectionDescription: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  examList: {
    gap: 10,
    marginTop: 12,
  },

  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 12,
    padding: 15,
  },

  examCardText: {
    flex: 1,
  },

  examSubject: {
    color: '#31518f',
    fontSize: 17,
    fontWeight: 'bold',
  },

  subjectSchedule: {
    color: '#687080',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },

  examCount: {
    color: '#5d6470',
    fontSize: 12,
    marginTop: 4,
  },

  examStatus: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 'bold',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 7,
  },

  examStatusSaved: {
    color: '#28794c',
    backgroundColor: '#dff2e6',
  },

  examStatusNotCreated: {
    color: '#725b24',
    backgroundColor: '#fff0c8',
  },

  examStatusOutdated: {
    color: '#7a4d00',
    backgroundColor: '#ffe0a3',
  },

  learningProgress: {
    color: '#5d6470',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  examOpenText: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 12,
  },

  summaryCard: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
  },

  lectureSubjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
  },

  lectureSubjectText: {
    flex: 1,
  },

  lectureCount: {
    color: '#5d6470',
    fontSize: 12,
    marginTop: 5,
  },

  openTextInline: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 12,
  },

  subjectBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 8,
  },

  subjectBackButtonText: {
    color: '#31518f',
    fontSize: 18,
    fontWeight: 'bold',
  },

  createSummaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#28794c',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },

  createSummaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  subjectName: {
    flex: 1,
    color: '#1f633e',
    fontSize: 18,
    fontWeight: 'bold',
  },

  dateText: {
    color: '#555',
    fontSize: 13,
  },

  summaryPreview: {
    color: '#333',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  openText: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 10,
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 22,
  },

  modalContent: {
    maxHeight: '82%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  modalTitle: {
    color: '#111',
    fontSize: 21,
    fontWeight: 'bold',
  },

  modalProgress: {
    color: '#28794c',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
  },

  modalDate: {
    color: '#555',
    fontSize: 13,
    marginTop: 5,
  },

  modalScrollView: {
    flexShrink: 1,
    marginTop: 16,
  },

  modalSummaryText: {
    color: '#222',
    fontSize: 15,
    lineHeight: 23,
  },

  summaryEditInput: {
    minHeight: 250,
    maxHeight: 430,
    color: '#222',
    backgroundColor: '#f7f7f7',
    borderWidth: 1,
    borderColor: '#bdbdbd',
    borderRadius: 9,
    fontSize: 15,
    lineHeight: 23,
    padding: 12,
    marginTop: 16,
  },

  summaryEditError: {
    color: '#9b2c2c',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },

  saveSummaryButton: {
    backgroundColor: '#28794c',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },

  saveSummaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  cancelEditButton: {
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  cancelEditButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  editSummaryButton: {
    backgroundColor: '#28794c',
    borderRadius: 8,
    padding: 12,
    marginTop: 18,
  },

  summaryNavigationRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  summaryNavigationButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 8,
    paddingVertical: 10,
  },

  summaryNavigationButtonText: {
    color: '#28794c',
    fontSize: 14,
    fontWeight: 'bold',
  },

  editSummaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.55,
  },

  shareSummaryButton: {
    backgroundColor: '#31518f',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  shareSummaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  summaryDeleteError: {
    color: '#9b2c2c',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },

  deleteSummaryButton: {
    borderWidth: 1,
    borderColor: '#b33939',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  deleteSummaryButtonText: {
    color: '#b33939',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
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
