import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export type PracticeQuestion = {
  question: string;
  answer: string;
};


export type PracticeQuestionAssessment =
  | 'known'
  | 'review';


export type PracticeQuestionRecord = {
  id: string;
  subject: string;
  questions: PracticeQuestion[];
  assessments?: Record<
    string,
    PracticeQuestionAssessment
  >;
  sourceSummarySignature: string;
  createdAt: string;
};


export type PracticeQuestionRecords = Record<
  string,
  PracticeQuestionRecord
>;


const practiceQuestionGenerationVersion = 'v2-verified';


export const createPracticeQuestionRecordId = (
  subject: string
) => JSON.stringify([subject]);


export const createPracticeQuestionSourceSignature = (
  summaries: Pick<
    LectureSummaryRecord,
    'id' | 'createdAt'
  >[]
) => JSON.stringify([
  practiceQuestionGenerationVersion,
  [...summaries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((summary) => [summary.id, summary.createdAt])
]);


const isPracticeQuestion = (
  value: unknown
): value is PracticeQuestion => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const question = value as Partial<PracticeQuestion>;

  return (
    typeof question.question === 'string' &&
    question.question.trim() !== '' &&
    typeof question.answer === 'string' &&
    question.answer.trim() !== ''
  );
};


const isPracticeQuestionRecord = (
  value: unknown
): value is PracticeQuestionRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<PracticeQuestionRecord>;
  const assessmentsAreValid =
    record.assessments === undefined ||
    (
      typeof record.assessments === 'object' &&
      record.assessments !== null &&
      !Array.isArray(record.assessments) &&
      Object.entries(record.assessments).every(
        ([questionIndex, assessment]) =>
          /^\d+$/.test(questionIndex) &&
          (
            assessment === 'known' ||
            assessment === 'review'
          )
      )
    );

  return (
    typeof record.id === 'string' &&
    typeof record.subject === 'string' &&
    record.subject !== '' &&
    Array.isArray(record.questions) &&
    record.questions.length > 0 &&
    record.questions.every(isPracticeQuestion) &&
    assessmentsAreValid &&
    typeof record.sourceSummarySignature === 'string' &&
    record.sourceSummarySignature !== '' &&
    typeof record.createdAt === 'string' &&
    !Number.isNaN(new Date(record.createdAt).getTime()) &&
    record.id === createPracticeQuestionRecordId(
      record.subject
    )
  );
};


export const parsePracticeQuestionRecords = (
  savedRecords: string
): PracticeQuestionRecords => {
  const parsedRecords: unknown = JSON.parse(savedRecords);

  if (
    typeof parsedRecords !== 'object' ||
    parsedRecords === null ||
    Array.isArray(parsedRecords)
  ) {
    throw new Error('practiceQuestionRecordsの形式が不正です');
  }

  const entries = Object.entries(parsedRecords);

  if (
    !entries.every(
      ([recordId, record]) =>
        isPracticeQuestionRecord(record) &&
        record.id === recordId
    )
  ) {
    throw new Error('practiceQuestionRecordsの形式が不正です');
  }

  return parsedRecords as PracticeQuestionRecords;
};
