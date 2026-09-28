import type { PhotoRecord } from '@/types/photo';
import type { PhotoOcrRecords } from '@/types/photo-ocr';
import {
  getLectureSummarySourcePhotoIds,
  type LectureSummaryRecords,
} from '@/types/lecture-summary';
import { assignPhotoToLecture } from '@/utils/photo-lecture';
import { areSameSubjectNames } from '@/utils/timetable-subject';


const getLectureDateKey = (photo: PhotoRecord) => {
  const date = new Date(photo.takenAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ].join('-');
};


const isSameLecture = (
  photo: PhotoRecord,
  targetLecturePhoto: PhotoRecord
) => {
  const photoDateKey = getLectureDateKey(photo);
  const targetDateKey = getLectureDateKey(
    targetLecturePhoto
  );

  return (
    photoDateKey !== null &&
    photoDateKey === targetDateKey
  );
};


export const updateSelectedPhotoSubjects = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>,
  subject: string | null
) => photos.map((photo) =>
  selectedPhotoIds.has(photo.id)
    ? { ...photo, subject }
    : photo
);


export const moveSelectedPhotosToLecture = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>,
  targetLecturePhoto: PhotoRecord
) => photos.map((photo) =>
  selectedPhotoIds.has(photo.id) &&
  !isSameLecture(photo, targetLecturePhoto)
    ? assignPhotoToLecture(photo, targetLecturePhoto)
    : photo
);


export const countSelectedPhotosToMove = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>,
  targetLecturePhoto: PhotoRecord
) => photos.filter(
  (photo) =>
    selectedPhotoIds.has(photo.id) &&
    !isSameLecture(photo, targetLecturePhoto)
).length;


export const removeSelectedPhotos = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>
) => photos.filter(
  (photo) => !selectedPhotoIds.has(photo.id)
);


export const getFullySelectedLectureSummaryIds = (
  summaryRecords: LectureSummaryRecords,
  selectedPhotoIds: ReadonlySet<string>,
  currentSubject: string,
  nextSubject: string
) => {
  if (areSameSubjectNames(currentSubject, nextSubject)) {
    return [];
  }

  return Object.values(summaryRecords).flatMap((summary) => {
    if (!areSameSubjectNames(summary.subject, currentSubject)) {
      return [];
    }

    const sourcePhotoIds = getLectureSummarySourcePhotoIds(
      summary.sourceOcrSignature
    );

    return sourcePhotoIds !== null &&
      sourcePhotoIds.length > 0 &&
      sourcePhotoIds.every((photoId) =>
        selectedPhotoIds.has(photoId)
      )
      ? [summary.id]
      : [];
  });
};


export const getPhotosForBulkRecognition = (
  selectedPhotos: PhotoRecord[],
  ocrRecords: PhotoOcrRecords,
  overwriteRecognized = false
) => overwriteRecognized
  ? selectedPhotos
  : selectedPhotos.filter(
      (photo) => ocrRecords[photo.id] === undefined
    );
