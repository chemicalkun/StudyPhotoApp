import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseSubjectQuestionRecords,
  type SubjectQuestionRecord,
  type SubjectQuestionRecords,
} from '@/types/subject-question';


const subjectQuestionStorageKey = 'subjectQuestionRecords';


export const loadSubjectQuestionRecords = async () => {
  const savedRecords = await AsyncStorage.getItem(
    subjectQuestionStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parseSubjectQuestionRecords(savedRecords);
};


const saveSubjectQuestionRecords = async (
  records: SubjectQuestionRecords
) => {
  await AsyncStorage.setItem(
    subjectQuestionStorageKey,
    JSON.stringify(records)
  );
};


export const saveSubjectQuestionRecord = async (
  subject: string,
  question: string,
  answer: string,
  sourceSummarySignature: string
): Promise<SubjectQuestionRecord> => {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  if (
    subject === '' ||
    trimmedQuestion === '' ||
    trimmedAnswer === '' ||
    sourceSummarySignature === ''
  ) {
    throw new Error('保存する質問履歴がありません');
  }

  const records = await loadSubjectQuestionRecords();
  const createdAt = new Date().toISOString();
  const id = JSON.stringify([
    subject,
    createdAt,
    Math.random().toString(36).slice(2, 8),
  ]);
  const record: SubjectQuestionRecord = {
    id,
    subject,
    question: trimmedQuestion,
    answer: trimmedAnswer,
    sourceSummarySignature,
    createdAt,
  };

  await saveSubjectQuestionRecords({
    ...records,
    [id]: record,
  });

  return record;
};


export const updateSubjectQuestionRecord = async (
  recordId: string,
  question: string,
  answer: string
) => {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  if (
    recordId === '' ||
    trimmedQuestion === '' ||
    trimmedAnswer === ''
  ) {
    throw new Error('保存する質問履歴がありません');
  }

  const records = await loadSubjectQuestionRecords();
  const record = records[recordId];

  if (record === undefined) {
    throw new Error('質問履歴が見つかりません');
  }

  const updatedRecord: SubjectQuestionRecord = {
    ...record,
    question: trimmedQuestion,
    answer: trimmedAnswer,
  };

  await saveSubjectQuestionRecords({
    ...records,
    [recordId]: updatedRecord,
  });

  return updatedRecord;
};


export const deleteSubjectQuestionRecord = async (
  recordId: string
) => {
  if (recordId === '') {
    throw new Error('削除する質問履歴が不正です');
  }

  const records = await loadSubjectQuestionRecords();

  if (records[recordId] === undefined) {
    return;
  }

  const updatedRecords = { ...records };
  delete updatedRecords[recordId];

  await saveSubjectQuestionRecords(updatedRecords);
};
