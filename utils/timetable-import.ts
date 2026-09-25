import { Timetable } from '@/utils/classification';
import {
  PeriodNumber,
  periodNumbers,
} from '@/utils/period-times';
import { PhotoRecord } from '@/types/photo';
import {
  timetableDays,
  TimetableDay,
} from '@/utils/timetable-recognition';


export type TimetableImportCandidate = {
  day: TimetableDay;
  period: PeriodNumber;
  subject: string;
};

export type TimetableCandidateOverwrite = {
  day: TimetableDay;
  period: PeriodNumber;
  previousSubject: string;
  nextSubject: string;
};

type PhotoImportResult = {
  photos: PhotoRecord[];
  updatedCount: number;
};


export const findFirstAvailableTimetableSlot = (
  candidates: TimetableImportCandidate[],
  days: readonly TimetableDay[] = timetableDays,
  periods: readonly PeriodNumber[] = periodNumbers
) => {
  const usedSlots = new Set(
    candidates.map(
      (candidate) => `${candidate.day}-${candidate.period}`
    )
  );

  for (const day of days) {
    for (const period of periods) {
      if (!usedSlots.has(`${day}-${period}`)) {
        return { day, period };
      }
    }
  }

  return null;
};


export const getTimetableImportValidationError = (
  candidates: TimetableImportCandidate[]
) => {
  if (candidates.length === 0) {
    return '保存する時間割候補がありません。';
  }

  if (candidates.some((candidate) => candidate.subject.trim() === '')) {
    return '授業名が空欄の候補があります。授業名を入力するか、候補から外してください。';
  }

  const keys = candidates.map(
    (candidate) => `${candidate.day}-${candidate.period}`
  );

  if (new Set(keys).size !== keys.length) {
    return '同じ曜日・時限の候補が複数あります。曜日または時限を修正してください。';
  }

  return null;
};


export const getDuplicateTimetableSlots = (
  candidates: TimetableImportCandidate[]
) => {
  const slotCounts = candidates.reduce<Record<string, number>>(
    (counts, candidate) => {
      const key = `${candidate.day}-${candidate.period}`;

      return {
        ...counts,
        [key]: (counts[key] ?? 0) + 1,
      };
    },
    {}
  );

  return Object.entries(slotCounts)
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
};


export const getTimetableCandidateOverwrites = (
  timetable: Timetable,
  candidates: TimetableImportCandidate[]
): TimetableCandidateOverwrite[] =>
  candidates.flatMap((candidate) => {
    const previousSubject =
      timetable[
        `${candidate.day}-${candidate.period}`
      ]?.trim() ?? '';
    const nextSubject = candidate.subject.trim();

    return previousSubject !== '' &&
      previousSubject !== nextSubject
      ? [{
          day: candidate.day,
          period: candidate.period,
          previousSubject,
          nextSubject,
        }]
      : [];
  });


export const mergeTimetableCandidates = (
  timetable: Timetable,
  candidates: TimetableImportCandidate[]
): Timetable => {
  const mergedTimetable = { ...timetable };

  candidates.forEach((candidate) => {
    mergedTimetable[`${candidate.day}-${candidate.period}`] =
      candidate.subject.trim();
  });

  return mergedTimetable;
};


export const reclassifyPhotosForTimetableImport = (
  photos: PhotoRecord[],
  timetable: Timetable,
  candidates: TimetableImportCandidate[]
): PhotoImportResult => {
  const candidatesByKey = new Map(
    candidates.map((candidate) => [
      `${candidate.day}-${candidate.period}`,
      candidate,
    ])
  );
  let updatedCount = 0;

  const updatedPhotos = photos.map((photo) => {
    if (photo.period === null) {
      return photo;
    }

    const key = `${photo.day}-${photo.period}`;
    const candidate = candidatesByKey.get(key);

    if (candidate === undefined) {
      return photo;
    }

    const newSubject = candidate.subject.trim();
    const previousSubject = timetable[key]?.trim() ?? '';
    const isUnclassified =
      photo.subject === null || photo.subject === '未分類';
    const hasPreviousSubject =
      previousSubject !== '' &&
      photo.subject === previousSubject;

    if (
      photo.subject === newSubject ||
      (!isUnclassified && !hasPreviousSubject)
    ) {
      return photo;
    }

    updatedCount += 1;

    return {
      ...photo,
      subject: newSubject,
    };
  });

  return {
    photos: updatedPhotos,
    updatedCount,
  };
};
