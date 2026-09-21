import {
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
