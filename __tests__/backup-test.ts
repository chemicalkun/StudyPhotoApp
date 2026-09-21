import {
  backupStorageKeys,
  createStudyPhotoBackup,
} from '@/types/backup';


describe('StudyPhoto backup', () => {
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
  });
});
