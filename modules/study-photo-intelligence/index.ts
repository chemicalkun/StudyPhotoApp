import {
  requireOptionalNativeModule,
} from 'expo-modules-core';

import type {
  PracticeQuestion,
} from '@/types/practice-question';
import type { Flashcard } from '@/types/flashcard';


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
  answerLectureQuestion(
    text: string,
    question: string
  ): Promise<string>;
  createExamPreparation(text: string): Promise<string>;
  createPracticeQuestions(
    text: string
  ): Promise<PracticeQuestion[]>;
  createFlashcards(text: string): Promise<Flashcard[]>;
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


export const answerLectureQuestion = async (
  text: string,
  question: string
): Promise<string> => {
  if (nativeModule === null) {
    throw new Error(
      '端末内AI質問は新しい開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.answerLectureQuestion(
    text,
    question
  );
};


export const createExamPreparation = async (
  text: string
): Promise<string> => {
  if (nativeModule === null) {
    throw new Error(
      '端末内AI試験対策は新しい開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.createExamPreparation(text);
};


export const createPracticeQuestions = async (
  text: string
): Promise<PracticeQuestion[]> => {
  if (nativeModule === null) {
    throw new Error(
      '端末内AI練習問題は新しい開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.createPracticeQuestions(text);
};


export const createFlashcards = async (
  text: string
): Promise<Flashcard[]> => {
  if (nativeModule === null) {
    throw new Error(
      '端末内AIフラッシュカードは新しい開発ビルドでのみ利用できます。'
    );
  }

  return nativeModule.createFlashcards(text);
};
