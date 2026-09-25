import type { PhotoRecord } from '@/types/photo';
import {
  classifyClassTime,
  getDayName,
  type Timetable,
} from '@/utils/classification';
import type { PeriodTimes } from '@/utils/period-times';
import type { TimetableDisplayOptions } from '@/utils/timetable-display-options';


type PhotoReclassificationResult = {
  photos: PhotoRecord[];
  updatedCount: number;
};


export const reclassifyPhotosForSchedule = (
  photos: PhotoRecord[],
  timetable: Timetable,
  periodTimes: PeriodTimes,
  displayOptions: TimetableDisplayOptions
): PhotoReclassificationResult => {
  let updatedCount = 0;

  const updatedPhotos = photos.map((photo) => {
    const timetableSubject = photo.period === null
      ? null
      : timetable[
          `${photo.day}-${photo.period}`
        ]?.trim() || null;
    const isAutomaticallyClassified =
      photo.subject === null ||
      photo.subject === '未分類' ||
      (
        timetableSubject !== null &&
        photo.subject === timetableSubject
      );

    if (!isAutomaticallyClassified) {
      return photo;
    }

    const takenAt = new Date(photo.takenAt);

    if (Number.isNaN(takenAt.getTime())) {
      return photo;
    }

    const classInfo = classifyClassTime(
      getDayName(takenAt),
      takenAt.getHours(),
      takenAt.getMinutes(),
      periodTimes,
      timetable,
      displayOptions
    );

    if (
      photo.day === classInfo.day &&
      photo.period === classInfo.period &&
      photo.subject === classInfo.subject
    ) {
      return photo;
    }

    updatedCount += 1;

    return {
      ...photo,
      day: classInfo.day,
      period: classInfo.period,
      subject: classInfo.subject,
    };
  });

  return {
    photos: updatedPhotos,
    updatedCount,
  };
};
