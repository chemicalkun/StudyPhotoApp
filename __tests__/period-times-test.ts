import {
  defaultPeriodTimes,
  findPeriod,
  getPeriodTimesValidationError,
  PeriodTimes,
} from '@/utils/period-times';


describe('findPeriod', () => {
  test.each([
    [8, 59, null],
    [9, 0, 1],
    [10, 30, 1],
    [10, 31, null],
    [10, 40, 2],
    [17, 50, 5],
    [17, 51, null],
  ])(
    '%i:%iを正しい時限へ変換する',
    (hour, minute, expectedPeriod) => {
      expect(
        findPeriod(hour, minute, defaultPeriodTimes)
      ).toBe(expectedPeriod);
    }
  );

  test('変更した開始時刻を使用する', () => {
    const customPeriodTimes: PeriodTimes = {
      ...defaultPeriodTimes,
      1: { start: '08:50', end: '10:20' },
    };

    expect(findPeriod(8, 50, customPeriodTimes)).toBe(1);
    expect(findPeriod(8, 49, customPeriodTimes)).toBeNull();
  });
});


describe('getPeriodTimesValidationError', () => {
  test('正しい設定ではエラーにならない', () => {
    expect(
      getPeriodTimesValidationError(defaultPeriodTimes)
    ).toBeNull();
  });

  test('HH:mm形式でない時刻を検出する', () => {
    const invalidPeriodTimes: PeriodTimes = {
      ...defaultPeriodTimes,
      1: { start: '9:00', end: '10:30' },
    };

    expect(
      getPeriodTimesValidationError(invalidPeriodTimes)
    ).toContain('HH:mm形式');
  });

  test('前の時限と重なる設定を検出する', () => {
    const overlappingPeriodTimes: PeriodTimes = {
      ...defaultPeriodTimes,
      2: { start: '10:30', end: '12:10' },
    };

    expect(
      getPeriodTimesValidationError(
        overlappingPeriodTimes
      )
    ).toContain('前の時限の終了時刻より後');
  });
});
