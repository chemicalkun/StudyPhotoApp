import {
  getNextPendingImportantPhoto,
  groupPhotosBySubject,
  getLatestPhotoTakenAt,
  getPhotoLectureCount,
  getPhotoAcademicTerm,
  isUnclassifiedPhoto,
  parsePhotoRecords,
  type PhotoRecord,
} from '@/types/photo';
import { summarizePhotoClassifications } from '@/utils/photo-import-summary';
import { getExifTakenAt } from '@/utils/photo-metadata';


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
  test('複数写真の分類結果を授業ごとにまとめる', () => {
    expect(summarizePhotoClassifications([
      '月曜日 2限：有機化学',
      '月曜日 2限：有機化学',
      '火曜日 1限：英語',
    ])).toEqual([
      '月曜日 2限：有機化学（2枚）',
      '火曜日 1限：英語（1枚）',
    ]);
  });

  test('EXIFの撮影日時を読み取る', () => {
    const takenAt = getExifTakenAt({
      DateTimeOriginal: '2026:09:27 10:45:30',
    });

    expect(takenAt).not.toBeNull();
    expect(takenAt?.getFullYear()).toBe(2026);
    expect(takenAt?.getMonth()).toBe(8);
    expect(takenAt?.getDate()).toBe(27);
    expect(takenAt?.getHours()).toBe(10);
    expect(getExifTakenAt({
      DateTimeOriginal: 'invalid',
    })).toBeNull();
  });

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

  test('撮影日時を推定した写真を読み込む', () => {
    const photo = {
      ...createPhoto('estimated-photo', null),
      takenAtEstimated: true,
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0]
        .takenAtEstimated
    ).toBe(true);
  });

  test('授業回移動前の撮影日時を読み込む', () => {
    const photo = {
      ...createPhoto('moved-photo', '化学'),
      originalTakenAt: '2026-09-23T09:30:00.000Z',
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0]
        .originalTakenAt
    ).toBe('2026-09-23T09:30:00.000Z');
  });

  test('授業回内の写真の並び順を読み込む', () => {
    const photo = {
      ...createPhoto('ordered-photo', '化学'),
      lectureOrder: 2,
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0]
        .lectureOrder
    ).toBe(2);
  });

  test('重要な写真のマークを読み込む', () => {
    const photo = {
      ...createPhoto('important-photo', '化学'),
      isImportant: true,
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0]
        .isImportant
    ).toBe(true);
  });

  test('重要な写真の復習日時を読み込む', () => {
    const photo = {
      ...createPhoto('reviewed-important-photo', '化学'),
      isImportant: true,
      importantReviewedAt: '2026-09-30T01:00:00.000Z',
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0]
        .importantReviewedAt
    ).toBe('2026-09-30T01:00:00.000Z');
  });

  test('次の未復習の重要写真を選ぶ', () => {
    const firstPhoto = {
      ...createPhoto('first-important-photo', '化学'),
      isImportant: true,
    };
    const currentPhoto = {
      ...createPhoto('current-important-photo', '化学'),
      isImportant: true,
    };
    const nextPhoto = {
      ...createPhoto('next-important-photo', '化学'),
      isImportant: true,
    };

    expect(getNextPendingImportantPhoto(
      [firstPhoto, currentPhoto, nextPhoto],
      currentPhoto.id
    )?.id).toBe(nextPhoto.id);
    expect(getNextPendingImportantPhoto(
      [
        firstPhoto,
        currentPhoto,
        {
          ...nextPhoto,
          importantReviewedAt:
            '2026-09-30T01:00:00.000Z',
        },
      ],
      currentPhoto.id
    )?.id).toBe(firstPhoto.id);
    expect(getNextPendingImportantPhoto(
      [currentPhoto],
      currentPhoto.id
    )).toBeNull();
  });

  test('写真に保存したメモを読み込む', () => {
    const photo = {
      ...createPhoto('noted-photo', '化学'),
      note: '試験前に反応機構を見直す',
    };

    expect(
      parsePhotoRecords(JSON.stringify([photo]))[0].note
    ).toBe('試験前に反応機構を見直す');
  });

  test('旧い写真は撮影日から学期を補完する', () => {
    expect(
      getPhotoAcademicTerm(createPhoto('old-photo', '化学'))
    ).toEqual({ academicYear: 2026, term: '前期' });
  });
});
