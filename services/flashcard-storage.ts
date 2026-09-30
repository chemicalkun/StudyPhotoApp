import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createFlashcardRecordId,
  parseFlashcardRecords,
  type Flashcard,
  type FlashcardAssessment,
  type FlashcardRecord,
  type FlashcardRecords,
} from '@/types/flashcard';


const flashcardStorageKey = 'flashcardRecords';


export const loadFlashcardRecords = async () => {
  const savedRecords = await AsyncStorage.getItem(
    flashcardStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parseFlashcardRecords(savedRecords);
};


const saveFlashcardRecords = async (
  records: FlashcardRecords
) => {
  await AsyncStorage.setItem(
    flashcardStorageKey,
    JSON.stringify(records)
  );
};


export const saveFlashcardRecord = async (
  subject: string,
  cards: Flashcard[],
  sourceSummarySignature: string
): Promise<FlashcardRecord> => {
  if (
    subject === '' ||
    cards.length === 0 ||
    sourceSummarySignature === ''
  ) {
    throw new Error('保存するフラッシュカードがありません');
  }

  const records = await loadFlashcardRecords();
  const id = createFlashcardRecordId(subject);
  const record: FlashcardRecord = {
    id,
    subject,
    cards,
    assessments: {},
    sourceSummarySignature,
    createdAt: new Date().toISOString(),
  };

  await saveFlashcardRecords({
    ...records,
    [id]: record,
  });

  return record;
};


export const saveFlashcardAssessment = async (
  subject: string,
  cardIndex: number,
  assessment: FlashcardAssessment
) => {
  if (
    subject === '' ||
    !Number.isInteger(cardIndex) ||
    cardIndex < 0
  ) {
    throw new Error('保存するカード記録が不正です');
  }

  const records = await loadFlashcardRecords();
  const id = createFlashcardRecordId(subject);
  const record = records[id];

  if (
    record === undefined ||
    cardIndex >= record.cards.length
  ) {
    throw new Error('フラッシュカードが見つかりません');
  }

  const updatedRecord: FlashcardRecord = {
    ...record,
    assessments: {
      ...record.assessments,
      [String(cardIndex)]: assessment,
    },
  };

  await saveFlashcardRecords({
    ...records,
    [id]: updatedRecord,
  });

  return updatedRecord;
};


export const updateFlashcard = async (
  subject: string,
  cardIndex: number,
  card: Flashcard
) => {
  const term = card.term.trim();
  const definition = card.definition.trim();

  if (
    subject === '' ||
    !Number.isInteger(cardIndex) ||
    cardIndex < 0 ||
    term === '' ||
    definition === ''
  ) {
    throw new Error('保存するカードが不正です');
  }

  const records = await loadFlashcardRecords();
  const id = createFlashcardRecordId(subject);
  const record = records[id];

  if (record === undefined || cardIndex >= record.cards.length) {
    throw new Error('フラッシュカードが見つかりません');
  }

  const updatedCards = [...record.cards];
  updatedCards[cardIndex] = { term, definition };

  const updatedRecord: FlashcardRecord = {
    ...record,
    cards: updatedCards,
    createdAt: new Date().toISOString(),
  };

  await saveFlashcardRecords({
    ...records,
    [id]: updatedRecord,
  });

  return updatedRecord;
};
