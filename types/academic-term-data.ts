export const academicTermDataStorageKeys = [
  'photos',
  'photoOcrRecords',
  'lectureSummaryRecords',
  'examPreparationRecords',
  'practiceQuestionRecords',
  'flashcardRecords',
  'subjectQuestionRecords',
] as const;


export type AcademicTermDataStorageKey =
  typeof academicTermDataStorageKeys[number];


export type AcademicTermDataSnapshot = Partial<
  Record<AcademicTermDataStorageKey, string>
>;


export type AcademicTermData = Record<
  string,
  AcademicTermDataSnapshot
>;


export const parseAcademicTermData = (
  savedAcademicTermData: string
): AcademicTermData => {
  const parsedValue: unknown = JSON.parse(
    savedAcademicTermData
  );

  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('学期別学習データの形式が不正です');
  }

  const snapshots = parsedValue as Record<string, unknown>;
  const validKeys = new Set<string>(
    academicTermDataStorageKeys
  );
  const snapshotsAreValid = Object.values(snapshots).every(
    (snapshot) =>
      typeof snapshot === 'object' &&
      snapshot !== null &&
      !Array.isArray(snapshot) &&
      Object.entries(snapshot).every(
        ([key, value]) =>
          validKeys.has(key) && typeof value === 'string'
      )
  );

  if (!snapshotsAreValid) {
    throw new Error('学期別学習データの形式が不正です');
  }

  return snapshots as AcademicTermData;
};
