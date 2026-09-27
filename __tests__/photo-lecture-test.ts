import type { PhotoRecord } from '@/types/photo';
import { assignPhotoToLecture } from '@/utils/photo-lecture';


const createPhoto = (
  overrides: Partial<PhotoRecord> = {}
): PhotoRecord => ({
  id: 'photo-1',
  uri: 'file:///photo-1.jpg',
  takenAt: new Date(2026, 8, 28, 14, 32, 15, 250)
    .toISOString(),
  day: '月',
  period: 2,
  subject: '有機化学',
  ...overrides,
});


describe('assignPhotoToLecture', () => {
  it('移動先の授業日と元写真の時刻を組み合わせる', () => {
    const photo = createPhoto();
    const targetPhoto = createPhoto({
      id: 'target-photo',
      takenAt: new Date(2026, 8, 14, 9, 0)
        .toISOString(),
      day: '火',
      period: 3,
    });

    const movedPhoto = assignPhotoToLecture(
      photo,
      targetPhoto
    );
    const movedDate = new Date(movedPhoto.takenAt);

    expect(movedDate.getFullYear()).toBe(2026);
    expect(movedDate.getMonth()).toBe(8);
    expect(movedDate.getDate()).toBe(14);
    expect(movedDate.getHours()).toBe(14);
    expect(movedDate.getMinutes()).toBe(32);
    expect(movedPhoto.day).toBe('火');
    expect(movedPhoto.period).toBe(3);
    expect(movedPhoto.subject).toBe('有機化学');
    expect(movedPhoto.takenAtEstimated).toBe(true);
  });

  it('不正な日付は移動しない', () => {
    expect(() =>
      assignPhotoToLecture(
        createPhoto({ takenAt: 'invalid' }),
        createPhoto()
      )
    ).toThrow('授業回の日付が不正です');
  });
});
