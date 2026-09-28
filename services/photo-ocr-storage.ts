import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parsePhotoOcrRecords,
  type PhotoOcrBlock,
  type PhotoOcrRecord,
  type PhotoOcrRecords,
} from '@/types/photo-ocr';


const photoOcrStorageKey = 'photoOcrRecords';


export const loadPhotoOcrRecords = async () => {
  const savedRecords =
    await AsyncStorage.getItem(photoOcrStorageKey);

  if (savedRecords === null) {
    return {};
  }

  return parsePhotoOcrRecords(savedRecords);
};


const savePhotoOcrRecords = async (
  records: PhotoOcrRecords
) => {
  await AsyncStorage.setItem(
    photoOcrStorageKey,
    JSON.stringify(records)
  );
};


export const loadPhotoOcrRecord = async (
  photoId: string
) => {
  const records = await loadPhotoOcrRecords();

  return records[photoId] ?? null;
};


export const savePhotoOcrRecord = async (
  photoId: string,
  blocks: PhotoOcrBlock[]
): Promise<PhotoOcrRecord> => {
  const text = blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n');

  if (photoId === '' || text === '') {
    throw new Error('保存するOCR結果がありません');
  }

  const records = await loadPhotoOcrRecords();
  const record: PhotoOcrRecord = {
    photoId,
    text,
    blocks,
    recognizedAt: new Date().toISOString(),
  };

  await savePhotoOcrRecords({
    ...records,
    [photoId]: record,
  });

  return record;
};


export const updatePhotoOcrText = async (
  photoId: string,
  text: string
): Promise<PhotoOcrRecord> => {
  const trimmedText = text.trim();

  if (photoId === '' || trimmedText === '') {
    throw new Error('保存するOCR結果がありません');
  }

  const records = await loadPhotoOcrRecords();
  const currentRecord = records[photoId];

  if (currentRecord === undefined) {
    throw new Error('OCR結果が見つかりません');
  }

  const currentTimestamp = new Date(
    currentRecord.recognizedAt
  ).getTime();
  const updatedTimestamp = Math.max(
    Date.now(),
    currentTimestamp + 1
  );

  const updatedRecord: PhotoOcrRecord = {
    ...currentRecord,
    text: trimmedText,
    recognizedAt: new Date(updatedTimestamp).toISOString(),
    manuallyEdited: true,
  };

  await savePhotoOcrRecords({
    ...records,
    [photoId]: updatedRecord,
  });

  return updatedRecord;
};


export const deletePhotoOcrRecord = async (
  photoId: string
) => {
  const records = await loadPhotoOcrRecords();

  if (records[photoId] === undefined) {
    return;
  }

  const updatedRecords = { ...records };
  delete updatedRecords[photoId];

  await savePhotoOcrRecords(updatedRecords);
};
