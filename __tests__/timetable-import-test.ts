import {
  findFirstAvailableTimetableSlot,
  getDuplicateTimetableSlots,
  getFirstInvalidTimetableCandidateIndex,
  getTimetableCandidateOverwrites,
  getTimetableImportValidationError,
  mergeTimetableCandidates,
  reclassifyPhotosForTimetableImport,
  TimetableImportCandidate,
} from '@/utils/timetable-import';
import { PhotoRecord } from '@/types/photo';


const candidates: TimetableImportCandidate[] = [
  {
    day: '月',
    period: 2,
    subject: '  高分子化学  ',
  },
];


describe('findFirstAvailableTimetableSlot', () => {
  test('未使用の最初の曜日・時限を返す', () => {
    expect(
      findFirstAvailableTimetableSlot([
        {
          day: '月',
          period: 1,
          subject: '有機化学',
        },
      ])
    ).toEqual({ day: '月', period: 2 });
  });
});


const createPhoto = (
  overrides: Partial<PhotoRecord> = {}
): PhotoRecord => ({
  id: 'photo-1',
  uri: 'file:///photo.jpg',
  takenAt: '2026-09-21T10:50:00.000Z',
  day: '月',
  period: 2,
  subject: null,
  ...overrides,
});


describe('getTimetableImportValidationError', () => {
  test('空欄の授業名を拒否する', () => {
    expect(
      getTimetableImportValidationError([
        { day: '月', period: 1, subject: ' ' },
      ])
    ).toContain('空欄');
  });

  test('同じ曜日・時限の重複を拒否する', () => {
    expect(
      getTimetableImportValidationError([
        { day: '月', period: 1, subject: '英語' },
        { day: '月', period: 1, subject: '数学' },
      ])
    ).toContain('複数');
  });
});


describe('getDuplicateTimetableSlots', () => {
  test('重複する曜日・時限だけを返す', () => {
    expect(
      getDuplicateTimetableSlots([
        { day: '月', period: 1, subject: '英語' },
        { day: '月', period: 1, subject: '数学' },
        { day: '火', period: 2, subject: '化学' },
      ])
    ).toEqual(['月-1']);
  });
});


describe('getFirstInvalidTimetableCandidateIndex', () => {
  test('空欄の授業名を最優先で返す', () => {
    expect(
      getFirstInvalidTimetableCandidateIndex([
        { day: '月', period: 1, subject: '英語' },
        { day: '火', period: 2, subject: ' ' },
        { day: '月', period: 1, subject: '数学' },
      ])
    ).toBe(1);
  });

  test('重複した最初の候補を返す', () => {
    expect(
      getFirstInvalidTimetableCandidateIndex([
        { day: '月', period: 1, subject: '英語' },
        { day: '火', period: 2, subject: '化学' },
        { day: '月', period: 1, subject: '数学' },
      ])
    ).toBe(0);
  });

  test('問題がなければ-1を返す', () => {
    expect(
      getFirstInvalidTimetableCandidateIndex([
        { day: '月', period: 1, subject: '英語' },
      ])
    ).toBe(-1);
  });
});


describe('mergeTimetableCandidates', () => {
  test('既存の別の授業を残して候補を追加する', () => {
    expect(
      mergeTimetableCandidates(
        { '火-1': '英語' },
        candidates
      )
    ).toEqual({
      '火-1': '英語',
      '月-2': '高分子化学',
    });
  });
});


describe('getTimetableCandidateOverwrites', () => {
  test('上書き対象の授業名の変更を返す', () => {
    expect(
      getTimetableCandidateOverwrites(
        {
          '月-2': '旧科目名',
          '火-1': '英語',
        },
        candidates
      )
    ).toEqual([
      {
        day: '月',
        period: 2,
        previousSubject: '旧科目名',
        nextSubject: '高分子化学',
      },
    ]);
  });
});


describe('reclassifyPhotosForTimetableImport', () => {
  test('同じ曜日・時限の未分類写真を更新する', () => {
    const result = reclassifyPhotosForTimetableImport(
      [createPhoto()],
      {},
      candidates
    );

    expect(result.updatedCount).toBe(1);
    expect(result.photos[0].subject).toBe('高分子化学');
  });

  test('既存の授業名を変更した写真も更新する', () => {
    const result = reclassifyPhotosForTimetableImport(
      [createPhoto({ subject: '旧科目名' })],
      { '月-2': '旧科目名' },
      candidates
    );

    expect(result.photos[0].subject).toBe('高分子化学');
  });

  test('別の科目に手動分類した写真は変更しない', () => {
    const result = reclassifyPhotosForTimetableImport(
      [createPhoto({ subject: '別の科目' })],
      { '月-2': '旧科目名' },
      candidates
    );

    expect(result.updatedCount).toBe(0);
    expect(result.photos[0].subject).toBe('別の科目');
  });
});
