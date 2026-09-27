import type { PhotoRecord } from '@/types/photo';


export const assignPhotoToLecture = (
  photo: PhotoRecord,
  targetLecturePhoto: PhotoRecord
): PhotoRecord => {
  const sourceDate = new Date(photo.takenAt);
  const targetDate = new Date(targetLecturePhoto.takenAt);

  if (
    Number.isNaN(sourceDate.getTime()) ||
    Number.isNaN(targetDate.getTime())
  ) {
    throw new Error('授業回の日付が不正です');
  }

  targetDate.setHours(
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds()
  );

  return {
    ...photo,
    takenAt: targetDate.toISOString(),
    day: targetLecturePhoto.day,
    period: targetLecturePhoto.period,
    subject: targetLecturePhoto.subject,
    takenAtEstimated: true,
  };
};
