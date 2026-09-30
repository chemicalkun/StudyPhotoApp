import AsyncStorage from '@react-native-async-storage/async-storage';


export const reviewDisplayOptionsStorageKey =
  'reviewDisplayOptions';

export type SubjectProgressSortMode =
  | 'attention'
  | 'subject';

export type SubjectProgressFilterMode =
  | 'attention'
  | 'all';

export type ReviewDisplayOptions = {
  showReviewQueue: boolean;
  showSubjectProgress: boolean;
  showImportantPhotos: boolean;
  showPhotoNotes: boolean;
  subjectProgressSortMode: SubjectProgressSortMode;
  subjectProgressFilterMode: SubjectProgressFilterMode;
};

export const defaultReviewDisplayOptions:
  ReviewDisplayOptions = {
    showReviewQueue: true,
    showSubjectProgress: true,
    showImportantPhotos: true,
    showPhotoNotes: true,
    subjectProgressSortMode: 'attention',
    subjectProgressFilterMode: 'attention',
  };


export const parseReviewDisplayOptions = (
  savedOptions: string
): ReviewDisplayOptions => {
  const parsedValue: unknown = JSON.parse(savedOptions);

  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('復習タブ表示設定の形式が不正です');
  }

  const candidate = parsedValue as Partial<
    ReviewDisplayOptions
  >;

  if (
    typeof candidate.showReviewQueue !== 'boolean' ||
    typeof candidate.showSubjectProgress !== 'boolean' ||
    typeof candidate.showImportantPhotos !== 'boolean' ||
    typeof candidate.showPhotoNotes !== 'boolean' ||
    (
      candidate.subjectProgressSortMode !== undefined &&
      candidate.subjectProgressSortMode !== 'attention' &&
      candidate.subjectProgressSortMode !== 'subject'
    ) ||
    (
      candidate.subjectProgressFilterMode !== undefined &&
      candidate.subjectProgressFilterMode !== 'attention' &&
      candidate.subjectProgressFilterMode !== 'all'
    )
  ) {
    throw new Error('復習タブ表示設定の形式が不正です');
  }

  return {
    showReviewQueue: candidate.showReviewQueue,
    showSubjectProgress: candidate.showSubjectProgress,
    showImportantPhotos: candidate.showImportantPhotos,
    showPhotoNotes: candidate.showPhotoNotes,
    subjectProgressSortMode:
      candidate.subjectProgressSortMode ?? 'attention',
    subjectProgressFilterMode:
      candidate.subjectProgressFilterMode ?? 'attention',
  };
};


export const loadReviewDisplayOptions = async (
): Promise<ReviewDisplayOptions> => {
  const savedOptions = await AsyncStorage.getItem(
    reviewDisplayOptionsStorageKey
  );

  return savedOptions === null
    ? defaultReviewDisplayOptions
    : parseReviewDisplayOptions(savedOptions);
};


export const saveReviewDisplayOptions = async (
  options: ReviewDisplayOptions
) => {
  const validatedOptions = parseReviewDisplayOptions(
    JSON.stringify(options)
  );

  await AsyncStorage.setItem(
    reviewDisplayOptionsStorageKey,
    JSON.stringify(validatedOptions)
  );
};
