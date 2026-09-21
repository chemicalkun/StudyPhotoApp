import {
  requireOptionalNativeModule,
} from 'expo-modules-core';


export type LectureSummaryAvailability =
  | 'available'
  | 'unsupportedOS'
  | 'deviceNotEligible'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady'
  | 'unknown'
  | 'unsupportedBuild';


type StudyPhotoIntelligenceNativeModule = {
  getAvailability(): Promise<LectureSummaryAvailability>;
  summarizeLecture(text: string): Promise<string>;
};


const nativeModule =
  requireOptionalNativeModule<StudyPhotoIntelligenceNativeModule>(
    'StudyPhotoIntelligence'
  );


export const getLectureSummaryAvailability = async (
): Promise<LectureSummaryAvailability> => {
  if (nativeModule === null) {
    return 'unsupportedBuild';
  }

  return nativeModule.getAvailability();
};


export const summarizeLecture = async (
  text: string
): Promise<string> => {
  if (nativeModule === null) {
    throw new Error(
      '端末内AI要約は新しい開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.summarizeLecture(text);
};
