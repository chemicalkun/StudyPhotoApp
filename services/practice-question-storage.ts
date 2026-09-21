import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createPracticeQuestionRecordId,
  parsePracticeQuestionRecords,
  type PracticeQuestion,
  type PracticeQuestionRecord,
  type PracticeQuestionRecords,
} from '@/types/practice-question';


const practiceQuestionStorageKey =
  'practiceQuestionRecords';


export const loadPracticeQuestionRecords = async () => {
  const savedRecords = await AsyncStorage.getItem(
    practiceQuestionStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parsePracticeQuestionRecords(savedRecords);
};


const savePracticeQuestionRecords = async (
  records: PracticeQuestionRecords
) => {
  await AsyncStorage.setItem(
    practiceQuestionStorageKey,
    JSON.stringify(records)
  );
};


export const savePracticeQuestionRecord = async (
  subject: string,
  questions: PracticeQuestion[],
  sourceSummarySignature: string
): Promise<PracticeQuestionRecord> => {
  if (
    subject === '' ||
    questions.length === 0 ||
    sourceSummarySignature === ''
  ) {
    throw new Error('保存する練習問題がありません');
  }

  const records = await loadPracticeQuestionRecords();
  const id = createPracticeQuestionRecordId(subject);
  const record: PracticeQuestionRecord = {
    id,
    subject,
    questions,
    sourceSummarySignature,
    createdAt: new Date().toISOString(),
  };

  await savePracticeQuestionRecords({
    ...records,
    [id]: record,
  });

  return record;
};
