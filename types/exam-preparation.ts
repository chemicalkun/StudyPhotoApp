import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export const examPreparationSourceLimit = 6_000;


export type ExamPreparationRecord = {
  id: string;
  subject: string;
  text: string;
  sourceSummarySignature: string;
  createdAt: string;
};


export type ExamPreparationRecords = Record<
  string,
  ExamPreparationRecord
>;


export const createExamPreparationRecordId = (
  subject: string
) => JSON.stringify([subject]);


export const createExamPreparationSourceSignature = (
  summaries: Pick<
    LectureSummaryRecord,
    'id' | 'createdAt'
  >[]
) => JSON.stringify(
  [...summaries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((summary) => [summary.id, summary.createdAt])
);


export const buildExamPreparationSource = (
  summaries: LectureSummaryRecord[],
  maxLength = examPreparationSourceLimit
) => {
  if (summaries.length === 0 || maxLength <= 0) {
    return '';
  }

  const sortedSummaries = [...summaries].sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey)
  );
  const headers = sortedSummaries.map(
    (summary, index) =>
      `第${index + 1}回（${summary.dateKey}）\n`
  );
  const separatorLength =
    Math.max(0, sortedSummaries.length - 1) * 2;
  const contentBudget = Math.max(
    0,
    maxLength -
      headers.reduce(
        (total, header) => total + header.length,
        0
      ) -
      separatorLength
  );
  const perSummaryLimit = Math.floor(
    contentBudget / sortedSummaries.length
  );

  return sortedSummaries
    .map((summary, index) => {
      return (
        headers[index] +
        summary.text.slice(0, perSummaryLimit)
      );
    })
    .join('\n\n')
    .slice(0, maxLength);
};


const isExamPreparationRecord = (
  value: unknown
): value is ExamPreparationRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<ExamPreparationRecord>;

  return (
    typeof record.id === 'string' &&
    typeof record.subject === 'string' &&
    record.subject !== '' &&
    typeof record.text === 'string' &&
    record.text.trim() !== '' &&
    typeof record.sourceSummarySignature === 'string' &&
    record.sourceSummarySignature !== '' &&
    typeof record.createdAt === 'string' &&
    !Number.isNaN(new Date(record.createdAt).getTime()) &&
    record.id === createExamPreparationRecordId(
      record.subject
    )
  );
};


export const parseExamPreparationRecords = (
  savedRecords: string
): ExamPreparationRecords => {
  const parsedRecords: unknown = JSON.parse(savedRecords);

  if (
    typeof parsedRecords !== 'object' ||
    parsedRecords === null ||
    Array.isArray(parsedRecords)
  ) {
    throw new Error('examPreparationRecordsの形式が不正です');
  }

  const entries = Object.entries(parsedRecords);

  if (
    !entries.every(
      ([recordId, record]) =>
        isExamPreparationRecord(record) &&
        record.id === recordId
    )
  ) {
    throw new Error('examPreparationRecordsの形式が不正です');
  }

  return parsedRecords as ExamPreparationRecords;
};
