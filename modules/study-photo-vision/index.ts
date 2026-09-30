import {
  requireOptionalNativeModule,
} from 'expo-modules-core';

import type {
  NormalizedImageRegion,
} from '@/utils/image-region';


export type RecognizedTextBlock = {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};


type StudyPhotoVisionNativeModule = {
  recognizeText(
    imageUri: string,
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number
  ): Promise<RecognizedTextBlock[]>;
};


const nativeModule =
  requireOptionalNativeModule<StudyPhotoVisionNativeModule>(
    'StudyPhotoVision'
  );


export const isStudyPhotoVisionAvailable =
  nativeModule !== null;


export const recognizeText = async (
  imageUri: string,
  region?: NormalizedImageRegion
): Promise<RecognizedTextBlock[]> => {
  if (nativeModule === null) {
    throw new Error(
      'Apple Vision文字認識は開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.recognizeText(
    imageUri,
    region?.x ?? 0,
    region?.y ?? 0,
    region?.width ?? 1,
    region?.height ?? 1
  );
};
