import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createAcademicTermId,
  getDefaultAcademicTerm,
  parseAcademicTerm,
  type AcademicTerm,
} from '@/types/academic-term';
import {
  parseAcademicTimetables,
  type AcademicTimetables,
} from '@/types/academic-timetable';
import { parseTimetable } from '@/utils/classification';


export const academicTermStorageKey = 'academicTerm';
export const academicTimetablesStorageKey =
  'academicTimetables';


export const loadAcademicTerm = async (
): Promise<AcademicTerm> => {
  const savedAcademicTerm = await AsyncStorage.getItem(
    academicTermStorageKey
  );

  return savedAcademicTerm === null
    ? getDefaultAcademicTerm()
    : parseAcademicTerm(savedAcademicTerm);
};


export const saveAcademicTerm = async (
  academicTerm: AcademicTerm
) => {
  const validatedAcademicTerm = parseAcademicTerm(
    JSON.stringify(academicTerm)
  );

  await AsyncStorage.setItem(
    academicTermStorageKey,
    JSON.stringify(validatedAcademicTerm)
  );

  return validatedAcademicTerm;
};


export const switchAcademicTerm = async (
  nextAcademicTerm: AcademicTerm
) => {
  const validatedNextAcademicTerm = parseAcademicTerm(
    JSON.stringify(nextAcademicTerm)
  );
  const storageKeys = [
    academicTermStorageKey,
    'timetable',
    academicTimetablesStorageKey,
  ] as const;
  const currentEntries = await AsyncStorage.multiGet([
    ...storageKeys,
  ]);
  const currentValues = Object.fromEntries(currentEntries);
  const currentAcademicTerm =
    currentValues.academicTerm === null
      ? getDefaultAcademicTerm()
      : parseAcademicTerm(currentValues.academicTerm);
  const currentTimetable =
    parseTimetable(currentValues.timetable) ?? {};
  const academicTimetables: AcademicTimetables =
    currentValues.academicTimetables === null
      ? {}
      : parseAcademicTimetables(
          currentValues.academicTimetables
        );
  const currentTermId = createAcademicTermId(
    currentAcademicTerm
  );
  const nextTermId = createAcademicTermId(
    validatedNextAcademicTerm
  );
  const updatedAcademicTimetables = {
    ...academicTimetables,
    [currentTermId]: currentTimetable,
  };
  const nextTimetable = currentTermId === nextTermId
    ? currentTimetable
    : updatedAcademicTimetables[nextTermId] ?? {};

  try {
    await AsyncStorage.multiSet([
      [
        academicTermStorageKey,
        JSON.stringify(validatedNextAcademicTerm),
      ],
      [
        academicTimetablesStorageKey,
        JSON.stringify(updatedAcademicTimetables),
      ],
      ['timetable', JSON.stringify(nextTimetable)],
    ]);
  } catch (error) {
    const entriesToRestore = currentEntries.flatMap(
      ([key, value]) =>
        value === null ? [] : [[key, value] as const]
    );
    const keysToRemove = currentEntries
      .filter(([, value]) => value === null)
      .map(([key]) => key);

    try {
      if (entriesToRestore.length > 0) {
        await AsyncStorage.multiSet(entriesToRestore);
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (rollbackError) {
      console.log(
        '学期切り替えの巻き戻しエラー:',
        rollbackError
      );
    }

    throw error;
  }

  return {
    academicTerm: validatedNextAcademicTerm,
    timetable: nextTimetable,
  };
};
