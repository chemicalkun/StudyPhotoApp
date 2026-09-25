import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  academicTermNames,
  createAcademicTermId,
  getDefaultAcademicTerm,
  parseAcademicTerm,
  parseAcademicTermId,
  type AcademicTerm,
} from '@/types/academic-term';
import {
  parseAcademicTimetables,
  type AcademicTimetables,
} from '@/types/academic-timetable';
import {
  academicTermDataStorageKeys,
  parseAcademicTermData,
  type AcademicTermData,
  type AcademicTermDataSnapshot,
} from '@/types/academic-term-data';
import { parsePhotoRecords } from '@/types/photo';
import { parseTimetable } from '@/utils/classification';


export const academicTermStorageKey = 'academicTerm';
export const academicTimetablesStorageKey =
  'academicTimetables';
export const academicTermDataStorageKey =
  'academicTermData';


export type AcademicTermOverview = {
  academicTerm: AcademicTerm;
  registeredClassCount: number;
  photoCount: number;
};


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


export const loadAvailableAcademicTerms = async (
): Promise<AcademicTerm[]> => {
  const [
    currentAcademicTerm,
    savedAcademicTimetables,
    savedAcademicTermData,
  ] = await Promise.all([
    loadAcademicTerm(),
    AsyncStorage.getItem(academicTimetablesStorageKey),
    AsyncStorage.getItem(academicTermDataStorageKey),
  ]);
  const academicTimetables = savedAcademicTimetables === null
    ? {}
    : parseAcademicTimetables(savedAcademicTimetables);
  const academicTermData = savedAcademicTermData === null
    ? {}
    : parseAcademicTermData(savedAcademicTermData);
  const termIds = new Set([
    createAcademicTermId(currentAcademicTerm),
    ...Object.keys(academicTimetables),
    ...Object.keys(academicTermData),
  ]);

  return [...termIds]
    .flatMap((termId) => {
      const academicTerm = parseAcademicTermId(termId);

      return academicTerm === null ? [] : [academicTerm];
    })
    .sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear - a.academicYear;
      }

      return (
        academicTermNames.indexOf(a.term) -
        academicTermNames.indexOf(b.term)
      );
    });
};


export const loadAcademicTermOverviews = async (
): Promise<AcademicTermOverview[]> => {
  const [
    currentAcademicTerm,
    savedCurrentTimetable,
    savedCurrentPhotos,
    savedAcademicTimetables,
    savedAcademicTermData,
  ] = await Promise.all([
    loadAcademicTerm(),
    AsyncStorage.getItem('timetable'),
    AsyncStorage.getItem('photos'),
    AsyncStorage.getItem(academicTimetablesStorageKey),
    AsyncStorage.getItem(academicTermDataStorageKey),
  ]);
  const currentTermId = createAcademicTermId(
    currentAcademicTerm
  );
  const currentTimetable =
    parseTimetable(savedCurrentTimetable) ?? {};
  const academicTimetables = savedAcademicTimetables === null
    ? {}
    : parseAcademicTimetables(savedAcademicTimetables);
  const academicTermData = savedAcademicTermData === null
    ? {}
    : parseAcademicTermData(savedAcademicTermData);
  const academicTerms = await loadAvailableAcademicTerms();

  return academicTerms.map((academicTerm) => {
    const termId = createAcademicTermId(academicTerm);
    const timetable = termId === currentTermId
      ? currentTimetable
      : academicTimetables[termId] ?? {};
    const savedPhotos = termId === currentTermId
      ? savedCurrentPhotos
      : academicTermData[termId]?.photos ?? null;

    return {
      academicTerm,
      registeredClassCount: Object.values(timetable)
        .filter((subject) => subject.trim() !== '')
        .length,
      photoCount: savedPhotos === null
        ? 0
        : parsePhotoRecords(savedPhotos).length,
    };
  });
};


export const switchAcademicTerm = async (
  nextAcademicTerm: AcademicTerm,
  options: {
    copyCurrentTimetable?: boolean;
  } = {}
) => {
  const validatedNextAcademicTerm = parseAcademicTerm(
    JSON.stringify(nextAcademicTerm)
  );
  const storageKeys = [
    academicTermStorageKey,
    'timetable',
    academicTimetablesStorageKey,
    academicTermDataStorageKey,
    ...academicTermDataStorageKeys,
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
  const academicTermData: AcademicTermData =
    currentValues.academicTermData === null
      ? {}
      : parseAcademicTermData(
          currentValues.academicTermData
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
  const hasSavedNextTimetable = Object.prototype.hasOwnProperty.call(
    updatedAcademicTimetables,
    nextTermId
  );
  const nextTimetable = currentTermId === nextTermId
    ? currentTimetable
    : options.copyCurrentTimetable && !hasSavedNextTimetable
      ? currentTimetable
      : updatedAcademicTimetables[nextTermId] ?? {};
  const currentTermData = Object.fromEntries(
    academicTermDataStorageKeys.flatMap((key) => {
      const value = currentValues[key];

      return value === null
        ? []
        : [[key, value] as const];
    })
  ) as AcademicTermDataSnapshot;
  const updatedAcademicTermData: AcademicTermData = {
    ...academicTermData,
    [currentTermId]: currentTermData,
  };
  const nextTermData = currentTermId === nextTermId
    ? currentTermData
    : updatedAcademicTermData[nextTermId] ?? {};
  const nextTermEntries = academicTermDataStorageKeys
    .flatMap((key) => {
      const value = nextTermData[key];

      return value === undefined
        ? []
        : [[key, value] as const];
    });
  const nextTermKeysToRemove = academicTermDataStorageKeys
    .filter((key) => nextTermData[key] === undefined);

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
      [
        academicTermDataStorageKey,
        JSON.stringify(updatedAcademicTermData),
      ],
      ['timetable', JSON.stringify(nextTimetable)],
      ...nextTermEntries,
    ]);

    if (nextTermKeysToRemove.length > 0) {
      await AsyncStorage.multiRemove(
        nextTermKeysToRemove
      );
    }
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
