import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

import {
  backupStorageKeys,
  createStudyPhotoBackup,
  parseStudyPhotoBackup,
  restorableBackupStorageKeys,
} from '@/types/backup';
import { parseAcademicTerm } from '@/types/academic-term';
import {
  parseAcademicTimetables,
} from '@/types/academic-timetable';
import {
  createRestorableAcademicTermData,
  parseAcademicTermData,
} from '@/types/academic-term-data';
import { parseExamPreparationRecords } from '@/types/exam-preparation';
import { parseFlashcardRecords } from '@/types/flashcard';
import { parseLectureSummaryRecords } from '@/types/lecture-summary';
import { parsePracticeQuestionRecords } from '@/types/practice-question';
import { parseSubjectQuestionRecords } from '@/types/subject-question';
import {
  getPeriodTimesValidationError,
  periodNumbers,
  type PeriodTimes,
} from '@/utils/period-times';


const parseJson = (savedValue: string) => {
  const parsedValue: unknown = JSON.parse(savedValue);

  return parsedValue;
};


const validateTimetable = (savedTimetable: string) => {
  const timetable = parseJson(savedTimetable);

  if (
    typeof timetable !== 'object' ||
    timetable === null ||
    Array.isArray(timetable) ||
    !Object.values(timetable).every(
      (subject) => typeof subject === 'string'
    )
  ) {
    throw new Error('時間割データが不正です');
  }
};


const validatePeriodTimes = (
  savedPeriodTimes: string
) => {
  const periodTimes = parseJson(savedPeriodTimes);

  if (
    typeof periodTimes !== 'object' ||
    periodTimes === null ||
    Array.isArray(periodTimes)
  ) {
    throw new Error('時限設定データが不正です');
  }

  const candidate = periodTimes as Record<
    string,
    unknown
  >;

  for (const period of periodNumbers) {
    const time = candidate[String(period)];

    if (
      typeof time !== 'object' ||
      time === null ||
      Array.isArray(time) ||
      typeof (time as { start?: unknown }).start !==
        'string' ||
      typeof (time as { end?: unknown }).end !== 'string'
    ) {
      throw new Error('時限設定データが不正です');
    }
  }

  if (
    getPeriodTimesValidationError(
      periodTimes as PeriodTimes
    ) !== null
  ) {
    throw new Error('時限設定データが不正です');
  }
};


const validateRestorableData = (
  storage: ReturnType<
    typeof parseStudyPhotoBackup
  >['storage']
) => {
  if (storage.academicTerm !== null) {
    parseAcademicTerm(storage.academicTerm);
  }

  if (storage.academicTimetables !== null) {
    parseAcademicTimetables(storage.academicTimetables);
  }

  if (storage.academicTermData !== null) {
    parseAcademicTermData(storage.academicTermData);
  }

  if (storage.timetable !== null) {
    validateTimetable(storage.timetable);
  }

  if (storage.periodTimes !== null) {
    validatePeriodTimes(storage.periodTimes);
  }

  if (storage.lectureSummaryRecords !== null) {
    parseLectureSummaryRecords(
      storage.lectureSummaryRecords
    );
  }

  if (storage.examPreparationRecords !== null) {
    parseExamPreparationRecords(
      storage.examPreparationRecords
    );
  }

  if (storage.practiceQuestionRecords !== null) {
    parsePracticeQuestionRecords(
      storage.practiceQuestionRecords
    );
  }

  if (storage.flashcardRecords !== null) {
    parseFlashcardRecords(storage.flashcardRecords);
  }

  if (storage.subjectQuestionRecords !== null) {
    parseSubjectQuestionRecords(
      storage.subjectQuestionRecords
    );
  }
};


export const createBackupFile = async () => {
  const entries = await AsyncStorage.multiGet([
    ...backupStorageKeys,
  ]);
  const backup = createStudyPhotoBackup(entries);
  const timestamp = backup.exportedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-');
  const backupFile = new File(
    Paths.cache,
    `StudyPhoto-backup-${timestamp}.json`
  );

  backupFile.create({ overwrite: true });
  backupFile.write(JSON.stringify(backup, null, 2));

  return backupFile.uri;
};


export const restoreBackup = async (
  savedBackup: string
) => {
  const backup = parseStudyPhotoBackup(savedBackup);

  validateRestorableData(backup.storage);

  const currentEntries = await AsyncStorage.multiGet([
    ...restorableBackupStorageKeys,
  ]);
  const currentValues = Object.fromEntries(currentEntries);
  const restorableStorage = {
    ...backup.storage,
    academicTermData: createRestorableAcademicTermData(
      backup.storage.academicTermData,
      currentValues.academicTermData
    ),
  };

  const entriesToRestore = restorableBackupStorageKeys
    .flatMap((key) => {
      const value = restorableStorage[key];

      return value === null ? [] : [[key, value] as const];
    });
  const keysToRemove = restorableBackupStorageKeys
    .filter((key) => restorableStorage[key] === null);

  try {
    if (entriesToRestore.length > 0) {
      await AsyncStorage.multiSet(entriesToRestore);
    }

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    const entriesToRollback = currentEntries.flatMap(
      ([key, value]) =>
        value === null ? [] : [[key, value] as const]
    );
    const rollbackKeysToRemove = currentEntries
      .filter(([, value]) => value === null)
      .map(([key]) => key);

    try {
      if (entriesToRollback.length > 0) {
        await AsyncStorage.multiSet(entriesToRollback);
      }

      if (rollbackKeysToRemove.length > 0) {
        await AsyncStorage.multiRemove(
          rollbackKeysToRemove
        );
      }
    } catch (rollbackError) {
      console.log(
        'バックアップ復元の巻き戻しエラー:',
        rollbackError
      );
    }

    throw error;
  }

  return backup;
};
