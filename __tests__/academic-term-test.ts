import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadAcademicTerm,
  saveAcademicTerm,
} from '@/services/academic-term-storage';
import {
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
