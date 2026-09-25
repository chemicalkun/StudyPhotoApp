import {
  classifyClassTime,
  getDayName,
  parseTimetable,
} from '@/utils/classification';
import { defaultPeriodTimes } from '@/utils/period-times';


describe('classifyClassTime', () => {
  test('曜日と時限から登録済み授業を判定する', () => {
    const classInfo = classifyClassTime(
      '月',
      9,
      30,
      defaultPeriodTimes,
      { '月-1': '高分子化学' }
    );

    expect(classInfo).toEqual({
      day: '月',
      period: 1,
      subject: '高分子化学',
      label: '月曜日 1限：高分子化学',
    });
  });

  test('授業未登録の場合は曜日・時限だけを保持する', () => {
    const classInfo = classifyClassTime(
      '月',
      10,
      50,
      defaultPeriodTimes,
      {}
    );

    expect(classInfo.period).toBe(2);
    expect(classInfo.subject).toBeNull();
    expect(classInfo.label).toBe(
      '月曜日 2限：授業未登録'
    );
  });

  test('授業時間外は時限なしになる', () => {
    const classInfo = classifyClassTime(
      '月',
      8,
      30,
      defaultPeriodTimes,
      { '月-1': '高分子化学' }
    );

    expect(classInfo.period).toBeNull();
    expect(classInfo.subject).toBeNull();
    expect(classInfo.label).toBe('授業時間外');
  });

  test('日曜日は授業名を付けない', () => {
    const classInfo = classifyClassTime(
      '',
      9,
      30,
      defaultPeriodTimes,
      { '-1': '高分子化学' }
    );

    expect(classInfo.period).toBe(1);
    expect(classInfo.subject).toBeNull();
    expect(classInfo.label).toBe('日曜日は授業なし');
  });
});


describe('getDayName', () => {
  test('Dateから月曜日を取得する', () => {
    expect(getDayName(new Date(2026, 7, 24))).toBe('月');
  });

  test('土曜日を取得する', () => {
    expect(getDayName(new Date(2026, 7, 22))).toBe('土');
  });

  test('日曜日は空文字になる', () => {
    expect(getDayName(new Date(2026, 7, 23))).toBe('');
  });
});


describe('parseTimetable', () => {
  test('正しいJSONを時間割へ変換する', () => {
    expect(
      parseTimetable('{"月-1":"高分子化学"}')
    ).toEqual({ '月-1': '高分子化学' });
  });

  test('不正な時間割データを拒否する', () => {
    expect(() =>
      parseTimetable('{"月-1":123}')
    ).toThrow('timetableの形式が不正です');
  });
});
