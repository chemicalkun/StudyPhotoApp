import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadExamPreparationRecords,
  saveExamPreparationRecord,
} from '@/services/exam-preparation-storage';
import {
  loadFlashcardRecords,
  saveFlashcardRecord,
} from '@/services/flashcard-storage';
import {
  loadLectureSummaryRecords,
  saveLectureSummaryRecord,
} from '@/services/lecture-summary-storage';
import {
  loadPracticeQuestionRecords,
  savePracticeQuestionRecord,
} from '@/services/practice-question-storage';
import { renameSubjectLearningData } from '@/services/subject-learning-data-storage';
import {
  loadSubjectQuestionRecords,
  saveSubjectQuestionRecord,
} from '@/services/subject-question-storage';
import { createExamPreparationRecordId } from '@/types/exam-preparation';
import { createFlashcardRecordId } from '@/types/flashcard';
import { createLectureSummaryId } from '@/types/lecture-summary';
import { createPracticeQuestionRecordId } from '@/types/practice-question';


describe('subject learning data storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('授業名に紐づく学習データをまとめて変更して復元できる', async () => {
    await saveLectureSummaryRecord(
      '化学',
      '2026-09-21',
      '授業まとめ',
      'ocr-signature'
    );
    await saveExamPreparationRecord(
      '化学',
      '試験対策',
      'summary-signature'
    );
    await savePracticeQuestionRecord(
      '化学',
      [{ question: '問題', answer: '答え' }],
      'summary-signature'
    );
    await saveFlashcardRecord(
      '化学',
      [{ term: '用語', definition: '説明' }],
      'summary-signature'
    );
    const savedQuestion = await saveSubjectQuestionRecord(
      '化学',
      '質問',
      '回答',
      'summary-signature'
    );

    const result = await renameSubjectLearningData(
      '化学',
      '高分子化学'
    );

    expect(result.updatedRecordCount).toBe(5);
    expect(result.updatedLectureSummaryCount).toBe(1);
    expect(
      (await loadLectureSummaryRecords())[
        createLectureSummaryId('高分子化学', '2026-09-21')
      ]?.subject
    ).toBe('高分子化学');
    expect(
      (await loadExamPreparationRecords())[
        createExamPreparationRecordId('高分子化学')
      ]?.subject
    ).toBe('高分子化学');
    expect(
      (await loadPracticeQuestionRecords())[
        createPracticeQuestionRecordId('高分子化学')
      ]?.subject
    ).toBe('高分子化学');
    expect(
      (await loadFlashcardRecords())[
        createFlashcardRecordId('高分子化学')
      ]?.subject
    ).toBe('高分子化学');
    expect(
      (await loadSubjectQuestionRecords())[
        savedQuestion.id
      ]?.subject
    ).toBe('高分子化学');

    await result.rollback();

    expect(
      (await loadLectureSummaryRecords())[
        createLectureSummaryId('化学', '2026-09-21')
      ]?.subject
    ).toBe('化学');
    expect(
      (await loadExamPreparationRecords())[
        createExamPreparationRecordId('高分子化学')
      ]
    ).toBeUndefined();
  });

  test('全角と半角が異なる授業名も一致として変更する', async () => {
    await saveLectureSummaryRecord(
      'Ｃｈｅｍ',
      '2026-09-22',
      '授業まとめ',
      'ocr-signature'
    );

    const result = await renameSubjectLearningData(
      'Chem',
      '化学'
    );
    const records = await loadLectureSummaryRecords();

    expect(result.updatedLectureSummaryCount).toBe(1);
    expect(
      records[
        createLectureSummaryId('化学', '2026-09-22')
      ]?.subject
    ).toBe('化学');
  });

  test('変更後の授業に同じ日のまとめがある場合は変更しない', async () => {
    await saveLectureSummaryRecord(
      '化学',
      '2026-09-21',
      '変更前のまとめ',
      'old-ocr-signature'
    );
    await saveLectureSummaryRecord(
      '高分子化学',
      '2026-09-21',
      '既存のまとめ',
      'new-ocr-signature'
    );

    await expect(
      renameSubjectLearningData('化学', '高分子化学')
    ).rejects.toThrow(
      '変更後の授業名に同じ日のまとめがあります'
    );

    const records = await loadLectureSummaryRecords();

    expect(Object.values(records)).toHaveLength(2);
    expect(
      records[
        createLectureSummaryId('化学', '2026-09-21')
      ]?.text
    ).toBe('変更前のまとめ');
  });
});
