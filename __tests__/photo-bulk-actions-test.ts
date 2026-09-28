import type { PhotoRecord } from '@/types/photo';
import {
  countSelectedPhotosToMove,
  getFullySelectedLectureSummaryIds,
  getPhotosForBulkRecognition,
  moveSelectedPhotosToLecture,
  removeSelectedPhotos,
  updateSelectedPhotoSubjects,
} from '@/utils/photo-bulk-actions';
import {
  createLectureSummaryId,
  createLectureSummarySourceSignature,
  type LectureSummaryRecords,
} from '@/types/lecture-summary';


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

  it('移動先に既にある写真は更新しない', () => {
    const allSelectedIds = new Set([
      'photo-1',
      'photo-2',
      'photo-3',
    ]);
    const updated = moveSelectedPhotosToLecture(
      photos,
      allSelectedIds,
      photos[2]
    );

    expect(updated[2]).toBe(photos[2]);
    expect(updated[2].takenAtEstimated).toBeUndefined();
    expect(
      countSelectedPhotosToMove(
        photos,
        allSelectedIds,
        photos[2]
      )
    ).toBe(2);
  });

  it('選択した写真だけ削除する', () => {
    expect(
      removeSelectedPhotos(photos, selectedIds)
        .map((photo) => photo.id)
    ).toEqual(['photo-3']);
  });

  it('使用写真をすべて選択したまとめだけ移動対象にする', () => {
    const firstSummaryId = createLectureSummaryId(
      '有機化学',
      '2026-9-7'
    );
    const secondSummaryId = createLectureSummaryId(
      '有機化学',
      '2026-9-14'
    );
    const summaryRecords: LectureSummaryRecords = {
      [firstSummaryId]: {
        id: firstSummaryId,
        subject: '有機化学',
        dateKey: '2026-9-7',
        text: '第1回',
        sourceOcrSignature:
          createLectureSummarySourceSignature([
            { photoId: 'photo-1', recognizedAt: '2026-09-07T01:00:00.000Z' },
            { photoId: 'photo-2', recognizedAt: '2026-09-07T01:01:00.000Z' },
          ]),
        createdAt: '2026-09-07T02:00:00.000Z',
      },
      [secondSummaryId]: {
        id: secondSummaryId,
        subject: '有機化学',
        dateKey: '2026-9-14',
        text: '第2回',
        sourceOcrSignature:
          createLectureSummarySourceSignature([
            { photoId: 'photo-3', recognizedAt: '2026-09-14T01:00:00.000Z' },
          ]),
        createdAt: '2026-09-14T02:00:00.000Z',
      },
    };

    expect(
      getFullySelectedLectureSummaryIds(
        summaryRecords,
        selectedIds,
        '有機化学',
        '統計学'
      )
    ).toEqual([firstSummaryId]);
  });

  it('一括文字認識で認識済みの写真を上書きしない', () => {
    const ocrRecords = {
      'photo-1': {
        photoId: 'photo-1',
        text: '手動修正済み',
        blocks: [],
        recognizedAt: '2026-09-07T01:00:00.000Z',
        manuallyEdited: true,
      },
    };

    expect(
      getPhotosForBulkRecognition(photos, ocrRecords)
        .map((photo) => photo.id)
    ).toEqual(['photo-2', 'photo-3']);
    expect(
      getPhotosForBulkRecognition(
        photos,
        ocrRecords,
        true
      ).map((photo) => photo.id)
    ).toEqual(['photo-1', 'photo-2', 'photo-3']);
  });
});
