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
