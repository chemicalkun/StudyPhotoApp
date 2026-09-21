import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createFlashcardRecordId,
  parseFlashcardRecords,
  type Flashcard,
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
    sourceSummarySignature,
    createdAt: new Date().toISOString(),
  };

  await saveFlashcardRecords({
    ...records,
    [id]: record,
  });

  return record;
};
