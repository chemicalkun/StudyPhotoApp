import {
  findPeriod,
  PeriodTimes,
} from '@/utils/period-times';


export type ClassInfo = {
  day: string;
  period: number | null;
  subject: string | null;
  label: string;
};


export type Timetable = Record<string, string>;


const dayNames = ['', '月', '火', '水', '木', '金', ''];


export const getDayName = (date: Date) =>
  dayNames[date.getDay()];


export const isTimetable = (
  value: unknown
): value is Timetable => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  return Object.values(value).every(
    (subject) => typeof subject === 'string'
  );
};


export const parseTimetable = (
  savedTimetable: string | null
): Timetable | null => {
  if (savedTimetable === null) {
    return null;
  }

  const parsedTimetable: unknown =
    JSON.parse(savedTimetable);

  if (!isTimetable(parsedTimetable)) {
    throw new Error('timetableの形式が不正です');
  }

  return parsedTimetable;
};


export const classifyClassTime = (
  day: string,
  hour: number,
  minute: number,
  periodTimes: PeriodTimes,
  timetable: Timetable | null
): ClassInfo => {
  const period = findPeriod(
    hour,
    minute,
    periodTimes
  );

  if (period === null) {
    return {
      day,
      period: null,
      subject: null,
      label: '授業時間外',
    };
  }

  if (day === '') {
    return {
      day,
      period,
      subject: null,
      label: '土日は授業なし',
    };
  }

  if (timetable === null) {
    return {
      day,
      period,
      subject: null,
      label: '時間割未登録',
    };
  }

  const subject =
    timetable[`${day}-${period}`]?.trim() || null;

  if (subject === null) {
    return {
      day,
      period,
      subject: null,
      label: `${day}曜日 ${period}限：授業未登録`,
    };
  }

  return {
    day,
    period,
    subject,
    label: `${day}曜日 ${period}限：${subject}`,
  };
};
