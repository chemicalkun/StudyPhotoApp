import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createLectureSummaryId,
  parseLectureSummaryRecords,
  type LectureSummaryRecord,
  type LectureSummaryRecords,
} from '@/types/lecture-summary';


const lectureSummaryStorageKey = 'lectureSummaryRecords';


export const loadLectureSummaryRecords = async (
): Promise<LectureSummaryRecords> => {
  const savedRecords = await AsyncStorage.getItem(
    lectureSummaryStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parseLectureSummaryRecords(savedRecords);
};


const saveLectureSummaryRecords = async (
  records: LectureSummaryRecords
) => {
  await AsyncStorage.setItem(
    lectureSummaryStorageKey,
    JSON.stringify(records)
  );
};


export const saveLectureSummaryRecord = async (
  subject: string,
  dateKey: string,
  text: string,
  sourceOcrSignature: string
): Promise<LectureSummaryRecord> => {
  const trimmedText = text.trim();

  if (
    subject === '' ||
    dateKey === '' ||
    trimmedText === '' ||
    sourceOcrSignature === ''
  ) {
    throw new Error('保存する授業まとめがありません');
  }

  const records = await loadLectureSummaryRecords();
  const id = createLectureSummaryId(subject, dateKey);
  const record: LectureSummaryRecord = {
    id,
    subject,
    dateKey,
    text: trimmedText,
    sourceOcrSignature,
    createdAt: new Date().toISOString(),
  };

  await saveLectureSummaryRecords({
    ...records,
    [id]: record,
  });

  return record;
};


export const updateLectureSummaryText = async (
  summaryId: string,
  text: string
): Promise<LectureSummaryRecord> => {
  const trimmedText = text.trim();

  if (summaryId === '' || trimmedText === '') {
    throw new Error('保存する授業まとめがありません');
  }

  const records = await loadLectureSummaryRecords();
  const record = records[summaryId];

  if (record === undefined) {
    throw new Error('授業まとめが見つかりません');
  }

  const updatedRecord: LectureSummaryRecord = {
    ...record,
    text: trimmedText,
    createdAt: new Date().toISOString(),
  };

  await saveLectureSummaryRecords({
    ...records,
    [summaryId]: updatedRecord,
  });

  return updatedRecord;
};


export const moveLectureSummaryRecord = async (
  summaryId: string,
  nextSubject: string
): Promise<LectureSummaryRecord> => {
  const normalizedNextSubject = nextSubject.trim();

  if (summaryId === '' || normalizedNextSubject === '') {
    throw new Error('移動先の授業名が不正です');
  }

  const records = await loadLectureSummaryRecords();
  const currentRecord = records[summaryId];

  if (currentRecord === undefined) {
    throw new Error('移動する授業まとめが見つかりません');
  }

  const nextId = createLectureSummaryId(
    normalizedNextSubject,
    currentRecord.dateKey
  );

  if (nextId === summaryId) {
    return currentRecord;
  }

  if (records[nextId] !== undefined) {
    throw new Error(
      '移動先に同じ日の授業まとめがあります'
    );
  }

  const movedRecord: LectureSummaryRecord = {
    ...currentRecord,
    id: nextId,
    subject: normalizedNextSubject,
  };
  const nextRecords = { ...records };

  delete nextRecords[summaryId];
  nextRecords[nextId] = movedRecord;

  await saveLectureSummaryRecords(nextRecords);

  return movedRecord;
};


export const deleteLectureSummaryRecord = async (
  summaryId: string
): Promise<LectureSummaryRecord> => {
  if (summaryId === '') {
    throw new Error('削除する授業まとめがありません');
  }

  const records = await loadLectureSummaryRecords();
  const deletedRecord = records[summaryId];

  if (deletedRecord === undefined) {
    throw new Error('削除する授業まとめが見つかりません');
  }

  const nextRecords = { ...records };

  delete nextRecords[summaryId];
  await saveLectureSummaryRecords(nextRecords);

  return deletedRecord;
};
