import AsyncStorage from '@react-native-async-storage/async-storage';


export const periodNumbers = [1, 2, 3, 4, 5] as const;

export type PeriodNumber =
  (typeof periodNumbers)[number];

export type PeriodTime = {
  start: string;
  end: string;
};

export type PeriodTimes = Record<
  PeriodNumber,
  PeriodTime
>;


export const defaultPeriodTimes: PeriodTimes = {
  1: { start: '09:00', end: '10:30' },
  2: { start: '10:40', end: '12:10' },
  3: { start: '13:00', end: '14:30' },
  4: { start: '14:40', end: '16:10' },
  5: { start: '16:20', end: '17:50' },
};


const timeToMinutes = (time: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
    time
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour * 60 + minute;
};


export const getPeriodTimesValidationError = (
  periodTimes: PeriodTimes
) => {
  let previousEndMinutes: number | null = null;

  for (const period of periodNumbers) {
    const time = periodTimes[period];
    const startMinutes = timeToMinutes(time.start);
    const endMinutes = timeToMinutes(time.end);

    if (startMinutes === null || endMinutes === null) {
      return `${period}限の時刻をHH:mm形式で入力してください。`;
    }

    if (startMinutes >= endMinutes) {
      return `${period}限の終了時刻は開始時刻より後にしてください。`;
    }

    if (
      previousEndMinutes !== null &&
      startMinutes <= previousEndMinutes
    ) {
      return `${period}限の開始時刻は、前の時限の終了時刻より後にしてください。`;
    }

    previousEndMinutes = endMinutes;
  }

  return null;
};


const isPeriodTimes = (
  value: unknown
): value is PeriodTimes => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate = value as Partial<PeriodTimes>;

  for (const period of periodNumbers) {
    const time = candidate[period];

    if (
      typeof time !== 'object' ||
      time === null ||
      typeof time.start !== 'string' ||
      typeof time.end !== 'string'
    ) {
      return false;
    }
  }

  return (
    getPeriodTimesValidationError(
      candidate as PeriodTimes
    ) === null
  );
};


export const loadPeriodTimes = async () => {
  const savedPeriodTimes =
    await AsyncStorage.getItem('periodTimes');

  if (savedPeriodTimes === null) {
    return defaultPeriodTimes;
  }

  const parsedPeriodTimes: unknown =
    JSON.parse(savedPeriodTimes);

  if (!isPeriodTimes(parsedPeriodTimes)) {
    throw new Error('時限設定の形式が不正です');
  }

  return parsedPeriodTimes;
};


export const savePeriodTimes = async (
  periodTimes: PeriodTimes
) => {
  const validationError =
    getPeriodTimesValidationError(periodTimes);

  if (validationError !== null) {
    throw new Error(validationError);
  }

  await AsyncStorage.setItem(
    'periodTimes',
    JSON.stringify(periodTimes)
  );
};


export const findPeriod = (
  hour: number,
  minute: number,
  periodTimes: PeriodTimes
): PeriodNumber | null => {
  const currentMinutes = hour * 60 + minute;

  for (const period of periodNumbers) {
    const time = periodTimes[period];
    const startMinutes = timeToMinutes(time.start);
    const endMinutes = timeToMinutes(time.end);

    if (
      startMinutes !== null &&
      endMinutes !== null &&
      currentMinutes >= startMinutes &&
      currentMinutes <= endMinutes
    ) {
      return period;
    }
  }

  return null;
};
