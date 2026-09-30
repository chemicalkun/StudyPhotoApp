import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createExamPreparationRecordId,
  parseExamPreparationRecords,
  type ExamPreparationRecord,
  type ExamPreparationRecords,
} from '@/types/exam-preparation';


const examPreparationStorageKey = 'examPreparationRecords';


export const loadExamPreparationRecords = async (
): Promise<ExamPreparationRecords> => {
  const savedRecords = await AsyncStorage.getItem(
    examPreparationStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parseExamPreparationRecords(savedRecords);
};


const saveExamPreparationRecords = async (
  records: ExamPreparationRecords
) => {
  await AsyncStorage.setItem(
    examPreparationStorageKey,
    JSON.stringify(records)
  );
};


export const saveExamPreparationRecord = async (
  subject: string,
  text: string,
  sourceSummarySignature: string
): Promise<ExamPreparationRecord> => {
  const trimmedText = text.trim();

  if (
    subject === '' ||
    trimmedText === '' ||
    sourceSummarySignature === ''
  ) {
    throw new Error('保存する試験対策がありません');
  }

  const records = await loadExamPreparationRecords();
  const id = createExamPreparationRecordId(subject);
  const record: ExamPreparationRecord = {
    id,
    subject,
    text: trimmedText,
    sourceSummarySignature,
    createdAt: new Date().toISOString(),
  };

  await saveExamPreparationRecords({
    ...records,
    [id]: record,
  });

  return record;
};


export const updateExamPreparationText = async (
  recordId: string,
  text: string
): Promise<ExamPreparationRecord> => {
  const trimmedText = text.trim();

  if (recordId === '' || trimmedText === '') {
    throw new Error('保存する試験対策がありません');
  }

  const records = await loadExamPreparationRecords();
  const record = records[recordId];

  if (record === undefined) {
    throw new Error('試験対策が見つかりません');
  }

  const updatedRecord: ExamPreparationRecord = {
    ...record,
    text: trimmedText,
    createdAt: new Date().toISOString(),
  };

  await saveExamPreparationRecords({
    ...records,
    [recordId]: updatedRecord,
  });

  return updatedRecord;
};
