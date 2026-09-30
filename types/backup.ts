export const backupStorageKeys = [
  'academicTerm',
  'academicTimetables',
  'academicTermData',
  'timetable',
  'periodTimes',
  'timetableDisplayOptions',
  'reviewDisplayOptions',
  'photos',
  'photoOcrRecords',
  'lectureSummaryRecords',
  'examPreparationRecords',
  'practiceQuestionRecords',
  'flashcardRecords',
  'subjectQuestionRecords',
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


export const restorableBackupStorageKeys = [
  'academicTerm',
  'academicTimetables',
  'academicTermData',
  'timetable',
  'periodTimes',
  'timetableDisplayOptions',
  'reviewDisplayOptions',
  'lectureSummaryRecords',
  'examPreparationRecords',
  'practiceQuestionRecords',
  'flashcardRecords',
  'subjectQuestionRecords',
] as const satisfies readonly BackupStorageKey[];


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


export const parseStudyPhotoBackup = (
  savedBackup: string
): StudyPhotoBackup => {
  const parsedBackup: unknown = JSON.parse(savedBackup);

  if (
    typeof parsedBackup !== 'object' ||
    parsedBackup === null ||
    Array.isArray(parsedBackup)
  ) {
    throw new Error('バックアップ形式が不正です');
  }

  const backup = parsedBackup as Partial<StudyPhotoBackup>;

  if (
    backup.format !== 'studyphoto-backup' ||
    backup.version !== 1 ||
    typeof backup.exportedAt !== 'string' ||
    Number.isNaN(new Date(backup.exportedAt).getTime()) ||
    backup.includesPhotoFiles !== false ||
    typeof backup.storage !== 'object' ||
    backup.storage === null ||
    Array.isArray(backup.storage)
  ) {
    throw new Error('対応していないバックアップです');
  }

  const storage = backup.storage as Record<
    string,
    unknown
  >;
  const optionalLegacyKeys = new Set<BackupStorageKey>([
    'academicTerm',
    'academicTimetables',
    'academicTermData',
    'timetableDisplayOptions',
    'reviewDisplayOptions',
    'subjectQuestionRecords',
  ]);
  const hasValidStorageValues = backupStorageKeys.every(
    (key) => {
      if (
        optionalLegacyKeys.has(key) &&
        !Object.hasOwn(storage, key)
      ) {
        return true;
      }

      return (
        Object.hasOwn(storage, key) &&
        (
          typeof storage[key] === 'string' ||
          storage[key] === null
        )
      );
    }
  );

  if (!hasValidStorageValues) {
    throw new Error('バックアップ内のデータが不正です');
  }

  return {
    ...backup,
    storage: {
      ...storage,
      academicTerm:
        typeof storage.academicTerm === 'string'
          ? storage.academicTerm
          : null,
      academicTimetables:
        typeof storage.academicTimetables === 'string'
          ? storage.academicTimetables
          : null,
      academicTermData:
        typeof storage.academicTermData === 'string'
          ? storage.academicTermData
          : null,
      timetableDisplayOptions:
        typeof storage.timetableDisplayOptions === 'string'
          ? storage.timetableDisplayOptions
          : null,
      reviewDisplayOptions:
        typeof storage.reviewDisplayOptions === 'string'
          ? storage.reviewDisplayOptions
          : null,
      subjectQuestionRecords:
        typeof storage.subjectQuestionRecords === 'string'
          ? storage.subjectQuestionRecords
          : null,
    },
  } as StudyPhotoBackup;
};
