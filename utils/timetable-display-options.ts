import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  periodNumbers,
  type PeriodNumber,
} from '@/utils/period-times';
import {
  timetableDays,
  type TimetableDay,
} from '@/utils/timetable-recognition';


export const timetableDisplayOptionsStorageKey =
  'timetableDisplayOptions';

export type TimetableDisplayOptions = {
  showSaturday: boolean;
  showSixthPeriod: boolean;
};

export const defaultTimetableDisplayOptions:
  TimetableDisplayOptions = {
    showSaturday: false,
    showSixthPeriod: false,
  };


export const parseTimetableDisplayOptions = (
  savedOptions: string
): TimetableDisplayOptions => {
  const parsedValue: unknown = JSON.parse(savedOptions);

  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('時間割の表示範囲設定の形式が不正です');
  }

  const candidate = parsedValue as Partial<
    TimetableDisplayOptions
  >;

  if (
    typeof candidate.showSaturday !== 'boolean' ||
    typeof candidate.showSixthPeriod !== 'boolean'
  ) {
    throw new Error('時間割の表示範囲設定の形式が不正です');
  }

  return {
    showSaturday: candidate.showSaturday,
    showSixthPeriod: candidate.showSixthPeriod,
  };
};


export const loadTimetableDisplayOptions = async (
): Promise<TimetableDisplayOptions> => {
  const savedOptions = await AsyncStorage.getItem(
    timetableDisplayOptionsStorageKey
  );

  return savedOptions === null
    ? defaultTimetableDisplayOptions
    : parseTimetableDisplayOptions(savedOptions);
};


export const saveTimetableDisplayOptions = async (
  options: TimetableDisplayOptions
) => {
  const validatedOptions = parseTimetableDisplayOptions(
    JSON.stringify(options)
  );

  await AsyncStorage.setItem(
    timetableDisplayOptionsStorageKey,
    JSON.stringify(validatedOptions)
  );
};


export const getEnabledTimetableDays = (
  options: TimetableDisplayOptions
): TimetableDay[] =>
  timetableDays.filter(
    (day) => day !== '土' || options.showSaturday
  );


export const getEnabledPeriodNumbers = (
  options: TimetableDisplayOptions
): PeriodNumber[] =>
  periodNumbers.filter(
    (period) => period !== 6 || options.showSixthPeriod
  );


export const isTimetableSlotEnabled = (
  day: string,
  period: number,
  options: TimetableDisplayOptions
) =>
  (day !== '土' || options.showSaturday) &&
  (period !== 6 || options.showSixthPeriod);
