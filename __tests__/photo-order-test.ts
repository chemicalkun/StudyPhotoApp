import type { PhotoRecord } from '@/types/photo';
import {
  applyLecturePhotoOrder,
  comparePhotosByLectureOrder,
} from '@/utils/photo-order';


const createPhoto = (
  id: string,
  day: number,
  hour: number,
  lectureOrder?: number
): PhotoRecord => ({
  id,
  uri: `file:///${id}.jpg`,
  takenAt: new Date(2026, 8, day, hour)
    .toISOString(),
  day: '月',
  period: 2,
  subject: '有機化学',
  ...(lectureOrder === undefined
    ? {}
    : { lectureOrder }),
});


describe('photo order', () => {
  it('授業日ごとに保存した順番で並べる', () => {
    const photos = [
      createPhoto('second', 28, 9, 1),
      createPhoto('next-lecture', 29, 8, 0),
      createPhoto('first', 28, 10, 0),
    ];

    expect(
      [...photos]
        .sort(comparePhotosByLectureOrder)
        .map((photo) => photo.id)
    ).toEqual(['first', 'second', 'next-lecture']);
  });

  it('順番未設定の写真は並び替え済みの写真の後に置く', () => {
    const photos = [
      createPhoto('new-photo', 28, 8),
      createPhoto('ordered-photo', 28, 10, 0),
    ];

    expect(
      [...photos]
        .sort(comparePhotosByLectureOrder)
        .map((photo) => photo.id)
    ).toEqual(['ordered-photo', 'new-photo']);
  });

  it('指定した写真に並び順を保存する', () => {
    const photos = [
      createPhoto('first', 28, 9),
      createPhoto('second', 28, 10),
      createPhoto('other', 29, 9),
    ];
    const updated = applyLecturePhotoOrder(
      photos,
      ['second', 'first']
    );

    expect(updated[0].lectureOrder).toBe(1);
    expect(updated[1].lectureOrder).toBe(0);
    expect(updated[2].lectureOrder).toBeUndefined();
  });

  it('重複した写真IDは保存しない', () => {
    expect(() =>
      applyLecturePhotoOrder(
        [createPhoto('photo-1', 28, 9)],
        ['photo-1', 'photo-1']
      )
    ).toThrow('写真の並び順が不正です');
  });
});
