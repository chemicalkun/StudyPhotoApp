import type { Timetable } from '@/utils/classification';


export type AcademicTimetables = Record<string, Timetable>;


export const parseAcademicTimetables = (
  savedAcademicTimetables: string
): AcademicTimetables => {
  const parsedValue: unknown = JSON.parse(
    savedAcademicTimetables
  );

  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('学期別時間割の形式が不正です');
  }

  const records = parsedValue as Record<string, unknown>;

  if (
    !Object.values(records).every(
      (timetable) =>
        typeof timetable === 'object' &&
        timetable !== null &&
        !Array.isArray(timetable) &&
        Object.values(timetable).every(
          (subject) => typeof subject === 'string'
        )
    )
  ) {
    throw new Error('学期別時間割の形式が不正です');
  }

  return records as AcademicTimetables;
};
