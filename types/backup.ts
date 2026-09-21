export const backupStorageKeys = [
  'timetable',
  'periodTimes',
  'photos',
  'photoOcrRecords',
  'lectureSummaryRecords',
  'examPreparationRecords',
  'practiceQuestionRecords',
  'flashcardRecords',
] as const;


export type BackupStorageKey =
  typeof backupStorageKeys[number];


export type StudyPhotoBackup = {
  format: 'studyphoto-backup';
  version: 1;
  exportedAt: string;
  includesPhotoFiles: false;
  storage: Record<BackupStorageKey, string | null>;
};


export const createStudyPhotoBackup = (
  entries: readonly (
    readonly [string, string | null]
  )[],
  exportedAt = new Date().toISOString()
): StudyPhotoBackup => {
  const savedValues = Object.fromEntries(entries);
  const storage = Object.fromEntries(
    backupStorageKeys.map((key) => [
      key,
      savedValues[key] ?? null,
    ])
  ) as Record<BackupStorageKey, string | null>;

  return {
    format: 'studyphoto-backup',
    version: 1,
    exportedAt,
    includesPhotoFiles: false,
    storage,
  };
};
