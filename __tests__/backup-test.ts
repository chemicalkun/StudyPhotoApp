import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getBackupOverview,
  loadLastBackupExportedAt,
  restoreBackup,
  saveLastBackupExportedAt,
} from '@/services/backup-storage';
import {
  backupStorageKeys,
  createStudyPhotoBackup,
  parseStudyPhotoBackup,
} from '@/types/backup';


describe('StudyPhoto backup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('すべての保存項目をバックアップ形式にまとめる', () => {
    const backup = createStudyPhotoBackup(
      [
        ['timetable', '{"月-1":"高分子化学"}'],
        ['lectureSummaryRecords', '{"summary":{}}'],
      ],
      '2026-09-21T12:00:00.000Z'
    );

    expect(backup).toMatchObject({
      format: 'studyphoto-backup',
      version: 1,
      exportedAt: '2026-09-21T12:00:00.000Z',
      includesPhotoFiles: false,
    });
    expect(Object.keys(backup.storage)).toEqual([
      ...backupStorageKeys,
    ]);
    expect(backup.storage.timetable).toBe(
      '{"月-1":"高分子化学"}'
    );
    expect(backup.storage.flashcardRecords).toBeNull();
    expect(
      backup.storage.timetableDisplayOptions
    ).toBeNull();
    expect(backup.storage.reviewDisplayOptions).toBeNull();
    expect(backup.storage.subjectQuestionRecords).toBeNull();
  });

  test('最後にバックアップを書き出した日時を保存する', async () => {
    expect(await loadLastBackupExportedAt()).toBeNull();

    await saveLastBackupExportedAt(
      '2026-09-26T06:30:00.000Z'
    );

    expect(await loadLastBackupExportedAt()).toBe(
      '2026-09-26T06:30:00.000Z'
    );
  });

  test('復元前にバックアップの主要データ件数を確認する', () => {
    const currentTermId = JSON.stringify([2026, '前期']);
    const previousTermId = JSON.stringify([2025, '後期']);
    const summaryId = JSON.stringify(['有機化学', '2026-04-10']);
    const examPreparationId = JSON.stringify(['有機化学']);
    const backup = createStudyPhotoBackup([
      [
        'academicTerm',
        JSON.stringify({
          academicYear: 2026,
          term: '前期',
        }),
      ],
      [
        'academicTimetables',
        JSON.stringify({
          [currentTermId]: { '月-1': '有機化学' },
          [previousTermId]: { '火-2': '英語' },
        }),
      ],
      [
        'lectureSummaryRecords',
        JSON.stringify({
          [summaryId]: {
            id: summaryId,
            subject: '有機化学',
            dateKey: '2026-04-10',
            text: '授業まとめ',
            sourceOcrSignature: '[]',
            createdAt: '2026-04-10T03:00:00.000Z',
          },
        }),
      ],
      [
        'examPreparationRecords',
        JSON.stringify({
          [examPreparationId]: {
            id: examPreparationId,
            subject: '有機化学',
            text: '試験対策',
            sourceSummarySignature: '[]',
            createdAt: '2026-04-11T03:00:00.000Z',
          },
        }),
      ],
    ]);

    expect(getBackupOverview(backup)).toEqual({
      academicTermCount: 2,
      lectureSummaryCount: 1,
      examPreparationCount: 1,
    });
  });

  test('新しい保存項目がない旧バックアップも読み込める', () => {
    const backup = createStudyPhotoBackup([]);
    const legacyStorage = {
      ...backup.storage,
    } as Record<string, string | null>;

    delete legacyStorage.academicTerm;
    delete legacyStorage.academicTimetables;
    delete legacyStorage.academicTermData;
    delete legacyStorage.timetableDisplayOptions;
    delete legacyStorage.reviewDisplayOptions;
    delete legacyStorage.subjectQuestionRecords;

    const parsed = parseStudyPhotoBackup(JSON.stringify({
      ...backup,
      storage: legacyStorage,
    }));

    expect(parsed.storage.academicTerm).toBeNull();
    expect(parsed.storage.academicTimetables).toBeNull();
    expect(parsed.storage.academicTermData).toBeNull();
    expect(
      parsed.storage.timetableDisplayOptions
    ).toBeNull();
    expect(parsed.storage.reviewDisplayOptions).toBeNull();
    expect(parsed.storage.subjectQuestionRecords).toBeNull();
  });

  test('対応していないバックアップを拒否する', () => {
    expect(() =>
      parseStudyPhotoBackup(JSON.stringify({
        format: 'unknown',
        version: 1,
      }))
    ).toThrow('対応していないバックアップです');
  });

  test('学習データを復元し写真情報は上書きしない', async () => {
    await AsyncStorage.setItem(
      'photos',
      '[{"id":"current-photo"}]'
    );
    await AsyncStorage.setItem(
      'photoOcrRecords',
      '{"current":{"text":"現在のOCR"}}'
    );
    const backup = createStudyPhotoBackup([
      ['timetable', '{"月-1":"高分子化学"}'],
      ['photos', '[{"id":"old-photo"}]'],
      [
        'photoOcrRecords',
        '{"backup":{"text":"過去のOCR"}}',
      ],
      ['lectureSummaryRecords', '{}'],
    ]);

    await restoreBackup(JSON.stringify(backup));

    expect(await AsyncStorage.getItem('timetable')).toBe(
      '{"月-1":"高分子化学"}'
    );
    expect(await AsyncStorage.getItem('photos')).toBe(
      '[{"id":"current-photo"}]'
    );
    expect(
      await AsyncStorage.getItem('photoOcrRecords')
    ).toBe('{"current":{"text":"現在のOCR"}}');
  });

  test('学期別学習データを復元し写真情報は現在の値を保つ', async () => {
    const termId = JSON.stringify([2026, '前期']);

    await AsyncStorage.setItem(
      'academicTermData',
      JSON.stringify({
        [termId]: {
          photos: '[{"id":"current-photo"}]',
          photoOcrRecords: '{"current":{}}',
          lectureSummaryRecords: '{"current":{}}',
        },
      })
    );
    const backup = createStudyPhotoBackup([
      [
        'academicTermData',
        JSON.stringify({
          [termId]: {
            photos: '[{"id":"backup-photo"}]',
            photoOcrRecords: '{"backup":{}}',
            lectureSummaryRecords: '{"backup":{}}',
            flashcardRecords: '{"cards":{}}',
          },
        }),
      ],
    ]);

    await restoreBackup(JSON.stringify(backup));

    const restoredData = JSON.parse(
      await AsyncStorage.getItem('academicTermData') ?? '{}'
    );

    expect(restoredData[termId]).toEqual({
      photos: '[{"id":"current-photo"}]',
      photoOcrRecords: '{"current":{}}',
      lectureSummaryRecords: '{"backup":{}}',
      flashcardRecords: '{"cards":{}}',
    });
  });

  test('壊れた学習データがある場合は何も上書きしない', async () => {
    await AsyncStorage.setItem(
      'timetable',
      '{"火-2":"現在の授業"}'
    );
    const backup = createStudyPhotoBackup([
      ['timetable', '{"月-1":"古い授業"}'],
      ['lectureSummaryRecords', '{"broken":true}'],
    ]);

    await expect(
      restoreBackup(JSON.stringify(backup))
    ).rejects.toThrow();

    expect(await AsyncStorage.getItem('timetable')).toBe(
      '{"火-2":"現在の授業"}'
    );
  });

  test('復元の途中で保存に失敗した場合は元のデータへ戻す', async () => {
    await AsyncStorage.setItem(
      'timetable',
      '{"火-2":"現在の授業"}'
    );
    const backup = createStudyPhotoBackup([
      ['timetable', '{"月-1":"復元する授業"}'],
    ]);
    const multiRemoveSpy = jest
      .spyOn(AsyncStorage, 'multiRemove')
      .mockRejectedValueOnce(
        new Error('テスト用の保存エラー')
      );

    await expect(
      restoreBackup(JSON.stringify(backup))
    ).rejects.toThrow('テスト用の保存エラー');

    expect(await AsyncStorage.getItem('timetable')).toBe(
      '{"火-2":"現在の授業"}'
    );

    multiRemoveSpy.mockRestore();
  });
});
