import {
  createFlashcardSourceSignature,
  type FlashcardRecords,
} from '@/types/flashcard';
import {
  createExamPreparationSourceSignature,
  type ExamPreparationRecords,
} from '@/types/exam-preparation';
import {
  getLectureSummaryUpdateReason,
  type LectureSummaryRecord,
} from '@/types/lecture-summary';
import {
  isUnclassifiedPhoto,
  type PhotoRecord,
} from '@/types/photo';
import type { PhotoOcrRecords } from '@/types/photo-ocr';
import {
  createPracticeQuestionSourceSignature,
  type PracticeQuestionRecords,
} from '@/types/practice-question';
import { comparePhotosByLectureOrder } from '@/utils/photo-order';


export type SubjectReviewProgress = {
  subject: string;
  practiceKnownCount: number;
  practiceReviewCount: number;
  practiceUnansweredCount: number;
  practiceIsOutdated: boolean;
  flashcardKnownCount: number;
  flashcardReviewCount: number;
  flashcardUnansweredCount: number;
  flashcardsAreOutdated: boolean;
  examPreparationIsMissing: boolean;
  examPreparationIsOutdated: boolean;
  importantPhotoCount: number;
  notedPhotoCount: number;
  currentSummaryCount: number;
  outdatedSummaryCount: number;
  missingSummaryCount: number;
};


export const getSubjectReviewPendingCount = (
  progress: SubjectReviewProgress
) =>
  (progress.practiceIsOutdated
    ? 1
    : progress.practiceReviewCount +
      progress.practiceUnansweredCount) +
  (progress.flashcardsAreOutdated
    ? 1
    : progress.flashcardReviewCount +
      progress.flashcardUnansweredCount) +
  (
    progress.examPreparationIsMissing ||
    progress.examPreparationIsOutdated
      ? 1
      : 0
  ) +
  progress.importantPhotoCount;


export const getSubjectLearningCompletion = (
  progress: SubjectReviewProgress
) => {
  const knownCount =
    (progress.practiceIsOutdated
      ? 0
      : progress.practiceKnownCount) +
    (progress.flashcardsAreOutdated
      ? 0
      : progress.flashcardKnownCount);
  const itemCount =
    knownCount +
    (progress.practiceIsOutdated
      ? 0
      : progress.practiceReviewCount +
        progress.practiceUnansweredCount) +
    (progress.flashcardsAreOutdated
      ? 0
      : progress.flashcardReviewCount +
        progress.flashcardUnansweredCount);

  return {
    knownCount,
    itemCount,
    percentage: itemCount === 0
      ? null
      : Math.round((knownCount / itemCount) * 100),
  };
};


export const getOverallLearningCompletion = (
  progressItems: SubjectReviewProgress[]
) => {
  const totals = progressItems.reduce(
    (result, progress) => {
      const completion =
        getSubjectLearningCompletion(progress);

      return {
        knownCount:
          result.knownCount + completion.knownCount,
        itemCount:
          result.itemCount + completion.itemCount,
      };
    },
    { knownCount: 0, itemCount: 0 }
  );

  return {
    ...totals,
    remainingCount: totals.itemCount - totals.knownCount,
    percentage: totals.itemCount === 0
      ? null
      : Math.round(
          (totals.knownCount / totals.itemCount) * 100
        ),
  };
};


export const sortSubjectReviewProgressByAttention = (
  progressItems: SubjectReviewProgress[]
) => [...progressItems].sort((progressA, progressB) => {
  const completionA = getSubjectLearningCompletion(progressA);
  const completionB = getSubjectLearningCompletion(progressB);

  if (
    completionA.percentage === null &&
    completionB.percentage !== null
  ) {
    return -1;
  }

  if (
    completionA.percentage !== null &&
    completionB.percentage === null
  ) {
    return 1;
  }

  if (
    completionA.percentage !== completionB.percentage &&
    completionA.percentage !== null &&
    completionB.percentage !== null
  ) {
    return completionA.percentage - completionB.percentage;
  }

  const summaryActionCountA =
    progressA.missingSummaryCount +
    progressA.outdatedSummaryCount;
  const summaryActionCountB =
    progressB.missingSummaryCount +
    progressB.outdatedSummaryCount;

  if (summaryActionCountA !== summaryActionCountB) {
    return summaryActionCountB - summaryActionCountA;
  }

  const pendingCountDifference =
    getSubjectReviewPendingCount(progressB) -
    getSubjectReviewPendingCount(progressA);

  return pendingCountDifference !== 0
    ? pendingCountDifference
    : progressA.subject.localeCompare(progressB.subject, 'ja');
});


export const subjectNeedsAttention = (
  progress: SubjectReviewProgress
) => {
  const practiceItemCount =
    progress.practiceKnownCount +
    progress.practiceReviewCount +
    progress.practiceUnansweredCount;
  const flashcardItemCount =
    progress.flashcardKnownCount +
    progress.flashcardReviewCount +
    progress.flashcardUnansweredCount;
  const completion = getSubjectLearningCompletion(progress);

  return (
    progress.missingSummaryCount > 0 ||
    progress.outdatedSummaryCount > 0 ||
    progress.practiceIsOutdated ||
    progress.flashcardsAreOutdated ||
    progress.examPreparationIsMissing ||
    progress.examPreparationIsOutdated ||
    practiceItemCount === 0 ||
    flashcardItemCount === 0 ||
    completion.percentage === null ||
    completion.percentage < 100
  );
};


const getPhotoSubject = (photo: PhotoRecord) =>
  isUnclassifiedPhoto(photo)
    ? '未分類'
    : photo.subject as string;


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


const countAssessments = (
  itemCount: number,
  assessments: Record<string, 'known' | 'review'> = {}
) => {
  let knownCount = 0;
  let reviewCount = 0;

  for (let index = 0; index < itemCount; index += 1) {
    const assessment = assessments[String(index)];

    if (assessment === 'known') {
      knownCount += 1;
    } else if (assessment === 'review') {
      reviewCount += 1;
    }
  }

  return {
    knownCount,
    reviewCount,
    unansweredCount:
      itemCount - knownCount - reviewCount,
  };
};


export const buildSubjectReviewProgress = ({
  summaries,
  photos,
  photoOcrRecords,
  practiceQuestionRecords,
  flashcardRecords,
  examPreparationRecords = {},
}: {
  summaries: LectureSummaryRecord[];
  photos: PhotoRecord[];
  photoOcrRecords: PhotoOcrRecords;
  practiceQuestionRecords: PracticeQuestionRecords;
  flashcardRecords: FlashcardRecords;
  examPreparationRecords?: ExamPreparationRecords;
}): SubjectReviewProgress[] => {
  const subjects = new Set<string>();

  summaries.forEach((summary) => subjects.add(summary.subject));
  photos.forEach((photo) => subjects.add(getPhotoSubject(photo)));
  Object.values(practiceQuestionRecords).forEach(
    (record) => subjects.add(record.subject)
  );
  Object.values(flashcardRecords).forEach(
    (record) => subjects.add(record.subject)
  );
  Object.values(examPreparationRecords).forEach(
    (record) => subjects.add(record.subject)
  );

  return [...subjects]
    .sort((subjectA, subjectB) =>
      subjectA.localeCompare(subjectB, 'ja')
    )
    .map((subject) => {
      const subjectPhotos = photos.filter(
        (photo) => getPhotoSubject(photo) === subject
      );
      const subjectSummaries = summaries.filter(
        (summary) => summary.subject === subject
      );
      const summaryByDateKey = new Map(
        subjectSummaries.map((summary) => [
          summary.dateKey,
          summary,
        ])
      );
      const photosByDateKey = subjectPhotos.reduce<
        Record<string, PhotoRecord[]>
      >((groups, photo) => {
        const dateKey = getPhotoDateKey(photo.takenAt);

        groups[dateKey] = [
          ...(groups[dateKey] ?? []),
          photo,
        ];

        return groups;
      }, {});
      const lectureDateKeys = new Set([
        ...Object.keys(photosByDateKey),
        ...subjectSummaries.map((summary) => summary.dateKey),
      ]);
      let currentSummaryCount = 0;
      let outdatedSummaryCount = 0;
      let missingSummaryCount = 0;

      lectureDateKeys.forEach((dateKey) => {
        const lecturePhotos = [
          ...(photosByDateKey[dateKey] ?? []),
        ].sort(comparePhotosByLectureOrder);
        const summary = summaryByDateKey.get(dateKey);

        if (summary === undefined) {
          missingSummaryCount += 1;
          return;
        }

        const updateReason = getLectureSummaryUpdateReason(
          summary.sourceOcrSignature,
          lecturePhotos.map((photo) => photo.id),
          lecturePhotos.flatMap((photo) => {
            const ocrRecord = photoOcrRecords[photo.id];

            return ocrRecord === undefined ? [] : [ocrRecord];
          }),
          lecturePhotos.map((photo) => ({
            photoId: photo.id,
            note: photo.note,
          }))
        );

        if (updateReason === null) {
          currentSummaryCount += 1;
        } else {
          outdatedSummaryCount += 1;
        }
      });

      const practiceRecord = Object.values(
        practiceQuestionRecords
      ).find((record) => record.subject === subject);
      const practiceIsOutdated =
        practiceRecord !== undefined &&
        practiceRecord.sourceSummarySignature !==
          createPracticeQuestionSourceSignature(
            subjectSummaries
          );
      const practiceCounts = countAssessments(
        practiceRecord?.questions.length ?? 0,
        practiceRecord?.assessments
      );
      const flashcardRecord = Object.values(
        flashcardRecords
      ).find((record) => record.subject === subject);
      const flashcardsAreOutdated =
        flashcardRecord !== undefined &&
        flashcardRecord.sourceSummarySignature !==
          createFlashcardSourceSignature(subjectSummaries);
      const flashcardCounts = countAssessments(
        flashcardRecord?.cards.length ?? 0,
        flashcardRecord?.assessments
      );
      const examPreparationRecord = Object.values(
        examPreparationRecords
      ).find((record) => record.subject === subject);
      const examPreparationIsMissing =
        subjectSummaries.length > 0 &&
        examPreparationRecord === undefined;
      const examPreparationIsOutdated =
        subjectSummaries.length > 0 &&
        examPreparationRecord !== undefined &&
        examPreparationRecord.sourceSummarySignature !==
          createExamPreparationSourceSignature(
            subjectSummaries
          );

      return {
        subject,
        practiceKnownCount: practiceCounts.knownCount,
        practiceReviewCount: practiceCounts.reviewCount,
        practiceUnansweredCount:
          practiceCounts.unansweredCount,
        practiceIsOutdated,
        flashcardKnownCount: flashcardCounts.knownCount,
        flashcardReviewCount: flashcardCounts.reviewCount,
        flashcardUnansweredCount:
          flashcardCounts.unansweredCount,
        flashcardsAreOutdated,
        examPreparationIsMissing,
        examPreparationIsOutdated,
        importantPhotoCount: subjectPhotos.filter(
          (photo) =>
            photo.isImportant === true &&
            photo.importantReviewedAt === undefined
        ).length,
        notedPhotoCount: subjectPhotos.filter(
          (photo) =>
            photo.note !== undefined &&
            photo.note.trim() !== ''
        ).length,
        currentSummaryCount,
        outdatedSummaryCount,
        missingSummaryCount,
      };
    });
};
