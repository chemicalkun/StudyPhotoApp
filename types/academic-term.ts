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


export const parseAcademicTerm = (
  savedAcademicTerm: string
): AcademicTerm => {
  const parsedValue: unknown = JSON.parse(savedAcademicTerm);

  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('学年・学期設定の形式が不正です');
  }

  const candidate = parsedValue as Partial<AcademicTerm>;

  if (
    !Number.isInteger(candidate.academicYear) ||
    (candidate.academicYear as number) < 2000 ||
    (candidate.academicYear as number) > 2100 ||
    !academicTermNames.some(
      (term) => term === candidate.term
    )
  ) {
    throw new Error('学年・学期設定の形式が不正です');
  }

  return candidate as AcademicTerm;
};
