import {
  getDefaultAcademicTerm,
  isAcademicTerm,
  type AcademicTerm,
} from '@/types/academic-term';


export type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
  academicTerm?: AcademicTerm;
  takenAtEstimated?: boolean;
  originalTakenAt?: string;
  lectureOrder?: number;
  isImportant?: boolean;
  importantReviewedAt?: string;
  note?: string;
};


export const isUnclassifiedPhoto = (
  photo: PhotoRecord
) =>
  photo.subject === null ||
  photo.subject.trim() === '' ||
  photo.subject === '未分類';


export const groupPhotosBySubject = (
  photos: PhotoRecord[]
) =>
  photos.reduce<Record<string, PhotoRecord[]>>(
    (groups, photo) => {
      if (isUnclassifiedPhoto(photo)) {
        return groups;
      }

      const subject = photo.subject;

      if (subject === null) {
        return groups;
      }

      groups[subject] = [
        ...(groups[subject] ?? []),
        photo,
      ];

      return groups;
    },
    {}
  );


export const getPhotoLectureCount = (
  photos: PhotoRecord[]
) => new Set(
  photos.map((photo) => {
    const date = new Date(photo.takenAt);

    return [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    ].join('-');
  })
).size;


export const getLatestPhotoTakenAt = (
  photos: PhotoRecord[]
): string | null => {
  const latestPhoto = photos.reduce<
    { takenAt: string; timestamp: number } | null
  >((latest, photo) => {
    const timestamp = new Date(photo.takenAt).getTime();

    if (
      Number.isNaN(timestamp) ||
      (latest !== null && timestamp <= latest.timestamp)
    ) {
      return latest;
    }

    return { takenAt: photo.takenAt, timestamp };
  }, null);

  return latestPhoto?.takenAt ?? null;
};


export const getNextPendingImportantPhoto = (
  photos: PhotoRecord[],
  currentPhotoId: string
): PhotoRecord | null => {
  const currentIndex = photos.findIndex(
    (photo) => photo.id === currentPhotoId
  );

  if (currentIndex < 0) {
    return null;
  }

  const isPendingImportantPhoto = (photo: PhotoRecord) =>
    photo.id !== currentPhotoId &&
    photo.isImportant === true &&
    photo.importantReviewedAt === undefined;
  const nextPhoto = photos
    .slice(currentIndex + 1)
    .find(isPendingImportantPhoto);

  if (nextPhoto !== undefined) {
    return nextPhoto;
  }

  return [...photos]
    .slice(0, currentIndex)
    .reverse()
    .find(isPendingImportantPhoto) ?? null;
};


export const getPhotoAcademicTerm = (
  photo: PhotoRecord
): AcademicTerm | null => {
  if (photo.academicTerm !== undefined) {
    return photo.academicTerm;
  }

  const takenAt = new Date(photo.takenAt);

  return Number.isNaN(takenAt.getTime())
    ? null
    : getDefaultAcademicTerm(takenAt);
};


export const isPhotoRecord = (
  value: unknown
): value is PhotoRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const photo = value as Partial<PhotoRecord>;

  return (
    typeof photo.id === 'string' &&
    typeof photo.uri === 'string' &&
    typeof photo.takenAt === 'string' &&
    typeof photo.day === 'string' &&
    (typeof photo.period === 'number' ||
      photo.period === null) &&
    (typeof photo.subject === 'string' ||
      photo.subject === null) &&
    (
      photo.academicTerm === undefined ||
      isAcademicTerm(photo.academicTerm)
    ) &&
    (
      photo.takenAtEstimated === undefined ||
      typeof photo.takenAtEstimated === 'boolean'
    ) &&
    (
      photo.originalTakenAt === undefined ||
      typeof photo.originalTakenAt === 'string'
    ) &&
    (
      photo.lectureOrder === undefined ||
      (
        Number.isInteger(photo.lectureOrder) &&
        photo.lectureOrder >= 0
      )
    ) &&
    (
      photo.isImportant === undefined ||
      typeof photo.isImportant === 'boolean'
    ) &&
    (
      photo.importantReviewedAt === undefined ||
      (
        typeof photo.importantReviewedAt === 'string' &&
        !Number.isNaN(
          new Date(photo.importantReviewedAt).getTime()
        )
      )
    ) &&
    (
      photo.note === undefined ||
      typeof photo.note === 'string'
    )
  );
};


export const parsePhotoRecords = (
  savedPhotos: string
): PhotoRecord[] => {
  const parsedPhotos: unknown = JSON.parse(savedPhotos);

  if (
    !Array.isArray(parsedPhotos) ||
    !parsedPhotos.every(isPhotoRecord)
  ) {
    throw new Error('photosの形式が不正です');
  }

  return parsedPhotos;
};
