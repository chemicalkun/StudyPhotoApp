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
import { loadAcademicTerm } from '@/services/academic-term-storage';


const photosStorageKey = 'photos';
const photosDirectoryName = 'studyphoto-photos';


const getManagedPhotoFile = (photoId: string) => {
  const photosDirectory = new Directory(
    Paths.document,
    photosDirectoryName
  );

  return new File(
    photosDirectory,
    `${photoId}.jpg`
  );
};


export const loadPhotoRecords = async () => {
  const savedPhotos =
    await AsyncStorage.getItem(photosStorageKey);

  if (savedPhotos === null) {
    return [];
  }

  const photos = parsePhotoRecords(savedPhotos);
  let repairedUri = false;

  const repairedPhotos = photos.map((photo) => {
    const managedPhotoFile = getManagedPhotoFile(photo.id);

    if (
      managedPhotoFile.exists &&
      managedPhotoFile.uri !== photo.uri
    ) {
      repairedUri = true;

      return {
        ...photo,
        uri: managedPhotoFile.uri,
      };
    }

    return photo;
  });

  if (repairedUri) {
    await savePhotoRecords(repairedPhotos);
  }

  return repairedPhotos;
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
  const sourceFile = new File(sourceUri);
  const savedFile = getManagedPhotoFile(id);
  const photosDirectory = savedFile.parentDirectory;

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
      academicTerm: await loadAcademicTerm(),
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
