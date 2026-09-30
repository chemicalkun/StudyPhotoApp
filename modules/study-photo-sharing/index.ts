import {
  requireOptionalNativeModule,
} from 'expo-modules-core';


type SharePhotoFilesResult = {
  completed: boolean;
};


type StudyPhotoSharingNativeModule = {
  shareFiles(
    fileUris: string[]
  ): Promise<SharePhotoFilesResult>;
};


const nativeModule =
  requireOptionalNativeModule<StudyPhotoSharingNativeModule>(
    'StudyPhotoSharing'
  );


export const isStudyPhotoSharingAvailable =
  nativeModule !== null;


export const sharePhotoFiles = async (
  fileUris: string[]
): Promise<SharePhotoFilesResult> => {
  if (nativeModule === null) {
    throw new Error(
      '複数写真の共有は新しい開発ビルドでのみ利用できます。'
    );
  }

  if (fileUris.length === 0) {
    throw new Error('共有する写真がありません。');
  }

  return nativeModule.shareFiles(fileUris);
};
