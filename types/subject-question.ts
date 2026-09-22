import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export type SubjectQuestionRecord = {
  id: string;
  subject: string;
  question: string;
  answer: string;
  sourceSummarySignature: string;
  createdAt: string;
};


export type SubjectQuestionRecords = Record<
  string,
  SubjectQuestionRecord
>;


export const createSubjectQuestionSourceSignature = (
  summaries: Pick<
    LectureSummaryRecord,
    'id' | 'createdAt'
  >[]
) => JSON.stringify(
  [...summaries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((summary) => [summary.id, summary.createdAt])
);


const isSubjectQuestionRecord = (
  value: unknown
): value is SubjectQuestionRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<SubjectQuestionRecord>;

  return (
    typeof record.id === 'string' &&
    record.id !== '' &&
    typeof record.subject === 'string' &&
    record.subject !== '' &&
    typeof record.question === 'string' &&
    record.question.trim() !== '' &&
    typeof record.answer === 'string' &&
    record.answer.trim() !== '' &&
    typeof record.sourceSummarySignature === 'string' &&
    record.sourceSummarySignature !== '' &&
    typeof record.createdAt === 'string' &&
    !Number.isNaN(new Date(record.createdAt).getTime())
  );
};


export const parseSubjectQuestionRecords = (
  savedRecords: string
): SubjectQuestionRecords => {
  const parsedRecords: unknown = JSON.parse(savedRecords);

  if (
    typeof parsedRecords !== 'object' ||
    parsedRecords === null ||
    Array.isArray(parsedRecords)
  ) {
    throw new Error('subjectQuestionRecordsの形式が不正です');
  }

  const entries = Object.entries(parsedRecords);

  if (
    !entries.every(
      ([recordId, record]) =>
        isSubjectQuestionRecord(record) &&
        record.id === recordId
    )
  ) {
    throw new Error('subjectQuestionRecordsの形式が不正です');
  }

  return parsedRecords as SubjectQuestionRecords;
};
