import AsyncStorage from '@react-native-async-storage/async-storage';

import { restoreBackup } from '@/services/backup-storage';
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
    expect(backup.storage.subjectQuestionRecords).toBeNull();
  });

  test('質問履歴がない旧バックアップも読み込める', () => {
    const backup = createStudyPhotoBackup([]);
    const storageWithoutQuestionHistory = {
      ...backup.storage,
    } as Record<string, string | null>;

    delete storageWithoutQuestionHistory.subjectQuestionRecords;

    const parsed = parseStudyPhotoBackup(JSON.stringify({
      ...backup,
      storage: storageWithoutQuestionHistory,
    }));

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
    const backup = createStudyPhotoBackup([
      ['timetable', '{"月-1":"高分子化学"}'],
      ['photos', '[{"id":"old-photo"}]'],
      ['lectureSummaryRecords', '{}'],
    ]);

    await restoreBackup(JSON.stringify(backup));

    expect(await AsyncStorage.getItem('timetable')).toBe(
      '{"月-1":"高分子化学"}'
    );
    expect(await AsyncStorage.getItem('photos')).toBe(
      '[{"id":"current-photo"}]'
    );
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
