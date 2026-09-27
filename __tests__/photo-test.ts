import {
  groupPhotosBySubject,
  getLatestPhotoTakenAt,
  getPhotoLectureCount,
  getPhotoAcademicTerm,
  isUnclassifiedPhoto,
  parsePhotoRecords,
  type PhotoRecord,
} from '@/types/photo';


const createPhoto = (
  id: string,
  subject: string | null
): PhotoRecord => ({
  id,
  uri: `file://${id}.jpg`,
  takenAt: '2026-09-23T09:30:00.000Z',
  day: '月',
  period: 1,
  subject,
});


describe('写真の授業分類', () => {
  test('授業名がない写真を未分類と判定する', () => {
    expect(isUnclassifiedPhoto(
      createPhoto('photo-1', null)
    )).toBe(true);
    expect(isUnclassifiedPhoto(
      createPhoto('photo-2', '')
    )).toBe(true);
    expect(isUnclassifiedPhoto(
      createPhoto('photo-3', '未分類')
    )).toBe(true);
  });

  test('未分類写真を授業グループに含めない', () => {
    const groups = groupPhotosBySubject([
      createPhoto('classified', '高分子化学'),
      createPhoto('unclassified', null),
    ]);

    expect(Object.keys(groups)).toEqual(['高分子化学']);
    expect(groups['高分子化学']).toHaveLength(1);
  });

  test('同じ日の写真を1回分の授業として数える', () => {
    expect(getPhotoLectureCount([
      createPhoto('first', '高分子化学'),
      {
        ...createPhoto('same-day', '高分子化学'),
        takenAt: '2026-09-23T10:30:00.000Z',
      },
      {
        ...createPhoto('next-week', '高分子化学'),
        takenAt: '2026-09-30T09:30:00.000Z',
      },
    ])).toBe(2);
  });

  test('最新の写真撮影日時を取得する', () => {
    expect(getLatestPhotoTakenAt([
      createPhoto('first', null),
      {
        ...createPhoto('latest', null),
        takenAt: '2026-09-30T09:30:00.000Z',
      },
      {
        ...createPhoto('invalid', null),
        takenAt: 'invalid',
      },
    ])).toBe('2026-09-30T09:30:00.000Z');
    expect(getLatestPhotoTakenAt([])).toBeNull();
  });

  test('新しい写真の学期情報を読み込む', () => {
    const photo = {
      ...createPhoto('term-photo', '高分子化学'),
      academicTerm: {
        academicYear: 2026,
        term: '通年' as const,
      },
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0]
        .academicTerm
    ).toEqual({ academicYear: 2026, term: '通年' });
  });

  test('旧い写真は撮影日から学期を補完する', () => {
    expect(
      getPhotoAcademicTerm(createPhoto('old-photo', '化学'))
    ).toEqual({ academicYear: 2026, term: '前期' });
  });
});
