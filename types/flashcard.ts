import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export type Flashcard = {
  term: string;
  definition: string;
};


export type FlashcardAssessment =
  | 'known'
  | 'review';


export type FlashcardRecord = {
  id: string;
  subject: string;
  cards: Flashcard[];
  assessments?: Record<string, FlashcardAssessment>;
  sourceSummarySignature: string;
  createdAt: string;
};


export type FlashcardRecords = Record<
  string,
  FlashcardRecord
>;


const flashcardGenerationVersion = 'v1-verified';


export const createFlashcardRecordId = (
  subject: string
) => JSON.stringify([subject]);


export const createFlashcardSourceSignature = (
  summaries: Pick<
    LectureSummaryRecord,
    'id' | 'createdAt'
  >[]
) => JSON.stringify([
  flashcardGenerationVersion,
  [...summaries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((summary) => [summary.id, summary.createdAt]),
]);


const isFlashcard = (
  value: unknown
): value is Flashcard => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const card = value as Partial<Flashcard>;

  return (
    typeof card.term === 'string' &&
    card.term.trim() !== '' &&
    typeof card.definition === 'string' &&
    card.definition.trim() !== ''
  );
};


const isFlashcardRecord = (
  value: unknown
): value is FlashcardRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<FlashcardRecord>;
  const assessmentsAreValid =
    record.assessments === undefined ||
    (
      typeof record.assessments === 'object' &&
      record.assessments !== null &&
      !Array.isArray(record.assessments) &&
      Object.entries(record.assessments).every(
        ([cardIndex, assessment]) =>
          /^\d+$/.test(cardIndex) &&
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
    Array.isArray(record.cards) &&
    record.cards.length > 0 &&
    record.cards.every(isFlashcard) &&
    assessmentsAreValid &&
    typeof record.sourceSummarySignature === 'string' &&
    record.sourceSummarySignature !== '' &&
    typeof record.createdAt === 'string' &&
    !Number.isNaN(new Date(record.createdAt).getTime()) &&
    record.id === createFlashcardRecordId(record.subject)
  );
};


export const parseFlashcardRecords = (
  savedRecords: string
): FlashcardRecords => {
  const parsedRecords: unknown = JSON.parse(savedRecords);

  if (
    typeof parsedRecords !== 'object' ||
    parsedRecords === null ||
    Array.isArray(parsedRecords)
  ) {
    throw new Error('flashcardRecordsの形式が不正です');
  }

  const entries = Object.entries(parsedRecords);

  if (
    !entries.every(
      ([recordId, record]) =>
        isFlashcardRecord(record) &&
        record.id === recordId
    )
  ) {
    throw new Error('flashcardRecordsの形式が不正です');
  }

  return parsedRecords as FlashcardRecords;
};
