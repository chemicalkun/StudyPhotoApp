import type { FlashcardRecords } from '@/types/flashcard';
import {
  getLectureSummaryUpdateReason,
  type LectureSummaryRecord,
} from '@/types/lecture-summary';
import {
  isUnclassifiedPhoto,
  type PhotoRecord,
} from '@/types/photo';
import type { PhotoOcrRecords } from '@/types/photo-ocr';
import type { PracticeQuestionRecords } from '@/types/practice-question';
import { comparePhotosByLectureOrder } from '@/utils/photo-order';


export type SubjectReviewProgress = {
  subject: string;
  practiceKnownCount: number;
  practiceReviewCount: number;
  flashcardKnownCount: number;
  flashcardReviewCount: number;
  importantPhotoCount: number;
  currentSummaryCount: number;
  outdatedSummaryCount: number;
  missingSummaryCount: number;
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

  return { knownCount, reviewCount };
};


export const buildSubjectReviewProgress = ({
  summaries,
  photos,
  photoOcrRecords,
  practiceQuestionRecords,
  flashcardRecords,
}: {
  summaries: LectureSummaryRecord[];
  photos: PhotoRecord[];
  photoOcrRecords: PhotoOcrRecords;
  practiceQuestionRecords: PracticeQuestionRecords;
  flashcardRecords: FlashcardRecords;
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
      const practiceCounts = countAssessments(
        practiceRecord?.questions.length ?? 0,
        practiceRecord?.assessments
      );
      const flashcardRecord = Object.values(
        flashcardRecords
      ).find((record) => record.subject === subject);
      const flashcardCounts = countAssessments(
        flashcardRecord?.cards.length ?? 0,
        flashcardRecord?.assessments
      );

      return {
        subject,
        practiceKnownCount: practiceCounts.knownCount,
        practiceReviewCount: practiceCounts.reviewCount,
        flashcardKnownCount: flashcardCounts.knownCount,
        flashcardReviewCount: flashcardCounts.reviewCount,
        importantPhotoCount: subjectPhotos.filter(
          (photo) => photo.isImportant === true
        ).length,
        currentSummaryCount,
        outdatedSummaryCount,
        missingSummaryCount,
      };
    });
};
