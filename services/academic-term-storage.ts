import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getDefaultAcademicTerm,
  parseAcademicTerm,
  type AcademicTerm,
} from '@/types/academic-term';


export const academicTermStorageKey = 'academicTerm';


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
