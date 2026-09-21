import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

import {
  backupStorageKeys,
  createStudyPhotoBackup,
} from '@/types/backup';


export const createBackupFile = async () => {
  const entries = await AsyncStorage.multiGet([
    ...backupStorageKeys,
  ]);
  const backup = createStudyPhotoBackup(entries);
  const timestamp = backup.exportedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-');
  const backupFile = new File(
    Paths.cache,
    `StudyPhoto-backup-${timestamp}.json`
  );

  backupFile.create({ overwrite: true });
  backupFile.write(JSON.stringify(backup, null, 2));

  return backupFile.uri;
};
