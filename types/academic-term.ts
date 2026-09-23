export const academicTermNames = [
  '前期',
  '後期',
  '通年',
  'その他',
] as const;


export type AcademicTermName =
  typeof academicTermNames[number];


export type AcademicTerm = {
  academicYear: number;
  term: AcademicTermName;
};


export const createAcademicTermId = (
  academicTerm: AcademicTerm
) => JSON.stringify([
  academicTerm.academicYear,
  academicTerm.term,
]);


export const getDefaultAcademicTerm = (
  date = new Date()
): AcademicTerm => {
  const month = date.getMonth() + 1;
  const academicYear = month <= 3
    ? date.getFullYear() - 1
    : date.getFullYear();

  return {
    academicYear,
    term: month >= 4 && month <= 9
      ? '前期'
      : '後期',
  };
};


export const formatAcademicTerm = (
  academicTerm: AcademicTerm
) => `${academicTerm.academicYear}年度 ${academicTerm.term}`;


export const isAcademicTerm = (
  value: unknown
): value is AcademicTerm => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate = value as Partial<AcademicTerm>;

  return (
    Number.isInteger(candidate.academicYear) &&
    (candidate.academicYear as number) >= 2000 &&
    (candidate.academicYear as number) <= 2100 &&
    academicTermNames.some(
      (term) => term === candidate.term
    )
  );
};


export const parseAcademicTerm = (
  savedAcademicTerm: string
): AcademicTerm => {
  const parsedValue: unknown = JSON.parse(savedAcademicTerm);

  if (!isAcademicTerm(parsedValue)) {
    throw new Error('学年・学期設定の形式が不正です');
  }

  return parsedValue;
};
