import {
  requireOptionalNativeModule,
} from 'expo-modules-core';


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
    imageUri: string
  ): Promise<RecognizedTextBlock[]>;
};


const nativeModule =
  requireOptionalNativeModule<StudyPhotoVisionNativeModule>(
    'StudyPhotoVision'
  );


export const isStudyPhotoVisionAvailable =
  nativeModule !== null;


export const recognizeText = async (
  imageUri: string
): Promise<RecognizedTextBlock[]> => {
  if (nativeModule === null) {
    throw new Error(
      'Apple Vision文字認識は開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.recognizeText(imageUri);
};
