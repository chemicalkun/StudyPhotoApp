import {
  groupPhotosBySubject,
  isUnclassifiedPhoto,
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
});
