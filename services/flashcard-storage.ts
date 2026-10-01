import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createFlashcardRecordId,
  parseFlashcardRecords,
  type Flashcard,
  type FlashcardAssessment,
  type FlashcardRecord,
  type FlashcardRecords,
  type FlashcardSession,
} from '@/types/flashcard';


const flashcardStorageKey = 'flashcardRecords';
let mutationQueue: Promise<void> = Promise.resolve();


const loadFlashcardRecordsFromStorage = async () => {
  const savedRecords = await AsyncStorage.getItem(
    flashcardStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parseFlashcardRecords(savedRecords);
};


export const loadFlashcardRecords = async () => {
  await mutationQueue;

  return loadFlashcardRecordsFromStorage();
};


const saveFlashcardRecords = async (
  records: FlashcardRecords
) => {
  await AsyncStorage.setItem(
    flashcardStorageKey,
    JSON.stringify(records)
  );
};


const mutateFlashcardRecords = <Result>(
  mutation: (
    records: FlashcardRecords
  ) => {
    records: FlashcardRecords;
    result: Result;
  }
): Promise<Result> => {
  const operation = mutationQueue.then(async () => {
    const records = await loadFlashcardRecordsFromStorage();
    const mutationResult = mutation(records);

    await saveFlashcardRecords(mutationResult.records);

    return mutationResult.result;
  });

  mutationQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
};


export const saveFlashcardRecord = async (
  subject: string,
  cards: Flashcard[],
  sourceSummarySignature: string,
  session?: FlashcardSession
): Promise<FlashcardRecord> => {
  if (
    subject === '' ||
    cards.length === 0 ||
    sourceSummarySignature === ''
  ) {
    throw new Error('保存するフラッシュカードがありません');
  }

  const id = createFlashcardRecordId(subject);
  const record: FlashcardRecord = {
    id,
    subject,
    cards,
    assessments: {},
    session,
    sourceSummarySignature,
    createdAt: new Date().toISOString(),
  };

  return mutateFlashcardRecords((records) => ({
    records: {
      ...records,
      [id]: record,
    },
    result: record,
  }));
};


export const saveFlashcardSession = async (
  subject: string,
  session: FlashcardSession
) => {
  if (subject === '') {
    throw new Error('保存する学習位置が不正です');
  }

  return mutateFlashcardRecords((records) => {
    const id = createFlashcardRecordId(subject);
    const record = records[id];

    if (record === undefined) {
      throw new Error('フラッシュカードが見つかりません');
    }

    const updatedRecord: FlashcardRecord = {
      ...record,
      session,
    };

    return {
      records: {
        ...records,
        [id]: updatedRecord,
      },
      result: updatedRecord,
    };
  });
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

  return mutateFlashcardRecords((records) => {
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

    return {
      records: {
        ...records,
        [id]: updatedRecord,
      },
      result: updatedRecord,
    };
  });
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

  return mutateFlashcardRecords((records) => {
    const id = createFlashcardRecordId(subject);
    const record = records[id];

    if (
      record === undefined ||
      cardIndex >= record.cards.length
    ) {
      throw new Error('フラッシュカードが見つかりません');
    }

    const updatedCards = [...record.cards];
    updatedCards[cardIndex] = { term, definition };

    const updatedRecord: FlashcardRecord = {
      ...record,
      cards: updatedCards,
      createdAt: new Date().toISOString(),
    };

    return {
      records: {
        ...records,
        [id]: updatedRecord,
      },
      result: updatedRecord,
    };
  });
};
