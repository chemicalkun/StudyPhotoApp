import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadAvailableAcademicTerms,
  loadAcademicTermOverviews,
  loadAcademicTerm,
  saveAcademicTerm,
  switchAcademicTerm,
} from '@/services/academic-term-storage';
import {
  createAcademicTermId,
  formatAcademicTerm,
  getDefaultAcademicTerm,
  parseAcademicTerm,
} from '@/types/academic-term';


describe('academic term', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('日本の年度と前後期を日付から求める', () => {
    expect(
      getDefaultAcademicTerm(new Date('2026-04-01'))
    ).toEqual({ academicYear: 2026, term: '前期' });
    expect(
      getDefaultAcademicTerm(new Date('2027-02-01'))
    ).toEqual({ academicYear: 2026, term: '後期' });
  });

  test('設定を保存して読み込む', async () => {
    await saveAcademicTerm({
      academicYear: 2026,
      term: '通年',
    });

    await expect(loadAcademicTerm()).resolves.toEqual({
      academicYear: 2026,
      term: '通年',
    });
    expect(
      formatAcademicTerm({
        academicYear: 2026,
        term: '通年',
      })
    ).toBe('2026年度 通年');
  });

  test('学期ごとに時間割を保存して切り替える', async () => {
    const firstTerm = {
      academicYear: 2026,
      term: '前期' as const,
    };
    const secondTerm = {
      academicYear: 2026,
      term: '後期' as const,
    };

    await saveAcademicTerm(firstTerm);
    await AsyncStorage.setItem(
      'timetable',
      JSON.stringify({ '月-1': '有機化学' })
    );

    await switchAcademicTerm(secondTerm);

    expect(await AsyncStorage.getItem('timetable')).toBe('{}');
    expect(await loadAcademicTerm()).toEqual(secondTerm);

    const savedTimetables = JSON.parse(
      await AsyncStorage.getItem('academicTimetables') ?? '{}'
    );

    expect(
      savedTimetables[createAcademicTermId(firstTerm)]
    ).toEqual({ '月-1': '有機化学' });

    await AsyncStorage.setItem(
      'timetable',
      JSON.stringify({ '火-2': '物理化学' })
    );
    await switchAcademicTerm(firstTerm);

    expect(
      JSON.parse(
        await AsyncStorage.getItem('timetable') ?? '{}'
      )
    ).toEqual({ '月-1': '有機化学' });
  });

  test('学期ごとに写真と学習データを切り替える', async () => {
    const firstTerm = {
      academicYear: 2026,
      term: '前期' as const,
    };
    const secondTerm = {
      academicYear: 2026,
      term: '後期' as const,
    };

    await saveAcademicTerm(firstTerm);
    await AsyncStorage.multiSet([
      ['photos', '[{"id":"first-photo"}]'],
      ['lectureSummaryRecords', '{"first":{}}'],
      ['flashcardRecords', '{"first":{}}'],
    ]);

    await switchAcademicTerm(secondTerm);

    expect(await AsyncStorage.getItem('photos')).toBeNull();
    expect(
      await AsyncStorage.getItem('lectureSummaryRecords')
    ).toBeNull();

    await AsyncStorage.multiSet([
      ['photos', '[{"id":"second-photo"}]'],
      ['lectureSummaryRecords', '{"second":{}}'],
    ]);
    await switchAcademicTerm(firstTerm);

    expect(await AsyncStorage.getItem('photos')).toBe(
      '[{"id":"first-photo"}]'
    );
    expect(
      await AsyncStorage.getItem('lectureSummaryRecords')
    ).toBe('{"first":{}}');
    expect(await AsyncStorage.getItem('flashcardRecords')).toBe(
      '{"first":{}}'
    );
  });

  test('保存済みの学期を新しい年度順で取得する', async () => {
    await saveAcademicTerm({
      academicYear: 2025,
      term: '後期',
    });
    await switchAcademicTerm({
      academicYear: 2026,
      term: '後期',
    });
    await switchAcademicTerm({
      academicYear: 2026,
      term: '前期',
    });

    await expect(loadAvailableAcademicTerms()).resolves.toEqual([
      { academicYear: 2026, term: '前期' },
      { academicYear: 2026, term: '後期' },
      { academicYear: 2025, term: '後期' },
    ]);
  });

  test('学期ごとの登録コマ数と写真枚数を取得する', async () => {
    const firstTerm = {
      academicYear: 2026,
      term: '前期' as const,
    };
    const secondTerm = {
      academicYear: 2026,
      term: '後期' as const,
    };

    await saveAcademicTerm(firstTerm);
    await AsyncStorage.multiSet([
      ['timetable', JSON.stringify({
        '月-1': '有機化学',
        '火-2': '物理化学',
      })],
      ['photos', JSON.stringify([
        {
          id: 'photo-1',
          uri: 'file:///photo-1.jpg',
          takenAt: '2026-04-10T09:00:00.000Z',
          day: '金',
          period: 1,
          subject: '有機化学',
        },
      ])],
    ]);
    await switchAcademicTerm(secondTerm);

    await expect(loadAcademicTermOverviews()).resolves.toEqual([
      {
        academicTerm: firstTerm,
        registeredClassCount: 2,
        photoCount: 1,
      },
      {
        academicTerm: secondTerm,
        registeredClassCount: 0,
        photoCount: 0,
      },
    ]);
  });

  test('不正な学年・学期設定を拒否する', () => {
    expect(() =>
      parseAcademicTerm(
        JSON.stringify({
          academicYear: 1999,
          term: '前期',
        })
      )
    ).toThrow('学年・学期設定の形式が不正です');

    expect(() =>
      parseAcademicTerm(
        JSON.stringify({
          academicYear: 2026,
          term: '夏学期',
        })
      )
    ).toThrow('学年・学期設定の形式が不正です');
  });
});
