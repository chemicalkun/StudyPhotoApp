import type { PhotoRecord } from '@/types/photo';
import { defaultPeriodTimes } from '@/utils/period-times';
import { reclassifyPhotosForSchedule } from '@/utils/photo-reclassification';


describe('reclassifyPhotosForSchedule', () => {
  test('土曜日を有効にしたら未分類写真を授業へ分類する', () => {
    const takenAt = new Date(2026, 8, 26, 9, 30);
    const photo: PhotoRecord = {
      id: 'saturday-photo',
      uri: 'file:///saturday-photo.jpg',
      takenAt: takenAt.toISOString(),
      day: '土',
      period: 1,
      subject: null,
    };
    const result = reclassifyPhotosForSchedule(
      [photo],
      { '土-1': '有機化学' },
      defaultPeriodTimes,
      {
        showSaturday: true,
        showSixthPeriod: false,
      }
    );

    expect(result.updatedCount).toBe(1);
    expect(result.photos[0].subject).toBe('有機化学');
  });

  test('手動で別の授業へ分類した写真は変更しない', () => {
    const takenAt = new Date(2026, 8, 26, 9, 30);
    const photo: PhotoRecord = {
      id: 'manual-photo',
      uri: 'file:///manual-photo.jpg',
      takenAt: takenAt.toISOString(),
      day: '土',
      period: 1,
      subject: '別の授業',
    };
    const result = reclassifyPhotosForSchedule(
      [photo],
      { '土-1': '有機化学' },
      defaultPeriodTimes,
      {
        showSaturday: true,
        showSixthPeriod: false,
      }
    );

    expect(result.updatedCount).toBe(0);
    expect(result.photos[0].subject).toBe('別の授業');
  });

  test('撮影日時を推定した写真は自動再分類しない', () => {
    const photo: PhotoRecord = {
      id: 'estimated-photo',
      uri: 'file:///estimated-photo.jpg',
      takenAt: new Date(2026, 8, 26, 9, 30).toISOString(),
      day: '',
      period: null,
      subject: null,
      takenAtEstimated: true,
    };
    const result = reclassifyPhotosForSchedule(
      [photo],
      { '土-1': '有機化学' },
      defaultPeriodTimes,
      {
        showSaturday: true,
        showSixthPeriod: false,
      }
    );

    expect(result.updatedCount).toBe(0);
    expect(result.photos[0]).toEqual(photo);
  });
});
