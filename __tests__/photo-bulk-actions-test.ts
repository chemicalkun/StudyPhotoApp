import type { PhotoRecord } from '@/types/photo';
import {
  moveSelectedPhotosToLecture,
  removeSelectedPhotos,
  updateSelectedPhotoSubjects,
} from '@/utils/photo-bulk-actions';


const createPhoto = (
  id: string,
  day: string,
  takenAt: Date
): PhotoRecord => ({
  id,
  uri: `file:///${id}.jpg`,
  takenAt: takenAt.toISOString(),
  day,
  period: 2,
  subject: '有機化学',
});


const photos = [
  createPhoto('photo-1', '月', new Date(2026, 8, 7, 10)),
  createPhoto('photo-2', '月', new Date(2026, 8, 7, 11)),
  createPhoto('photo-3', '火', new Date(2026, 8, 14, 10)),
];
const selectedIds = new Set(['photo-1', 'photo-2']);


describe('photo bulk actions', () => {
  it('選択した写真だけ授業名を変更する', () => {
    const updated = updateSelectedPhotoSubjects(
      photos,
      selectedIds,
      '統計学'
    );

    expect(updated.map((photo) => photo.subject)).toEqual([
      '統計学',
      '統計学',
      '有機化学',
    ]);
  });

  it('選択した写真だけ指定した授業回へ移動する', () => {
    const updated = moveSelectedPhotosToLecture(
      photos,
      selectedIds,
      photos[2]
    );

    expect(
      updated.slice(0, 2).map((photo) =>
        new Date(photo.takenAt).getDate()
      )
    ).toEqual([14, 14]);
    expect(new Date(updated[2].takenAt).getDate()).toBe(14);
    expect(updated[0].day).toBe('火');
    expect(updated[0].takenAtEstimated).toBe(true);
  });

  it('選択した写真だけ削除する', () => {
    expect(
      removeSelectedPhotos(photos, selectedIds)
        .map((photo) => photo.id)
    ).toEqual(['photo-3']);
  });
});
