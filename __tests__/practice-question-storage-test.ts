import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadPracticeQuestionRecords,
  savePracticeQuestionRecord,
} from '@/services/practice-question-storage';
import {
  createPracticeQuestionRecordId,
  createPracticeQuestionSourceSignature,
  parsePracticeQuestionRecords,
} from '@/types/practice-question';


describe('practice question storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('科目ごとの練習問題を保存して読み込む', async () => {
    const summaries = [
      {
        id: '["高分子化学","2026-09-21"]',
        createdAt: '2026-09-21T10:00:00.000Z',
      },
    ];
    const signature =
      createPracticeQuestionSourceSignature(summaries);

    const saved = await savePracticeQuestionRecord(
      '高分子化学',
      [{
        question: '重合とは何ですか？',
        answer: '単量体が結合して高分子になる反応です。',
      }],
      signature
    );
    const records = await loadPracticeQuestionRecords();

    expect(saved.id).toBe(
      createPracticeQuestionRecordId('高分子化学')
    );
    expect(records[saved.id]).toEqual(saved);
  });

  test('不正な保存データを拒否する', () => {
    expect(() =>
      parsePracticeQuestionRecords(JSON.stringify({
        invalid: {
          id: 'invalid',
          subject: '高分子化学',
          questions: [],
          sourceSummarySignature: 'signature',
          createdAt: '2026-09-21T10:00:00.000Z',
        },
      }))
    ).toThrow('practiceQuestionRecordsの形式が不正です');
  });
});
