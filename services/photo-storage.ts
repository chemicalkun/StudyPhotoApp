import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import {
  parsePhotoRecords,
  PhotoRecord,
} from '@/types/photo';


const photosStorageKey = 'photos';
const photosDirectoryName = 'studyphoto-photos';


export const loadPhotoRecords = async () => {
  const savedPhotos =
    await AsyncStorage.getItem(photosStorageKey);

  if (savedPhotos === null) {
    return [];
  }

  return parsePhotoRecords(savedPhotos);
};


export const savePhotoRecords = async (
  photos: PhotoRecord[]
) => {
  await AsyncStorage.setItem(
    photosStorageKey,
    JSON.stringify(photos)
  );
};


type SavePhotoFromUriInput = {
  sourceUri: string;
  takenAt: Date;
  day: string;
  period: number | null;
  subject: string | null;
};


export const savePhotoFromUri = async ({
  sourceUri,
  takenAt,
  day,
  period,
  subject,
}: SavePhotoFromUriInput) => {
  if (Number.isNaN(takenAt.getTime())) {
    throw new Error('撮影日時が不正です');
  }

  const id =
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const photosDirectory = new Directory(
    Paths.document,
    photosDirectoryName
  );
  const sourceFile = new File(sourceUri);
  const savedFile = new File(
    photosDirectory,
    `${id}.jpg`
  );

  try {
    photosDirectory.create({
      idempotent: true,
      intermediates: true,
    });
    sourceFile.copy(savedFile);

    const record: PhotoRecord = {
      id,
      uri: savedFile.uri,
      takenAt: takenAt.toISOString(),
      day,
      period,
      subject,
    };

    const photos = await loadPhotoRecords();

    await savePhotoRecords([
      record,
      ...photos,
    ]);

    return record;
  } catch (error) {
    try {
      if (savedFile.exists) {
        savedFile.delete();
      }
    } catch (cleanupError) {
      console.log(
        '写真ファイル後片付けエラー:',
        cleanupError
      );
    }

    throw error;
  }
};
