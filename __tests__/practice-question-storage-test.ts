import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadPracticeQuestionRecords,
  savePracticeQuestionAssessment,
  savePracticeQuestionRecord,
  savePracticeQuestionSession,
  updatePracticeQuestion,
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

  test('問題ごとの自己評価を保存する', async () => {
    await savePracticeQuestionRecord(
      '高分子化学',
      [{
        question: '重合とは何ですか？',
        answer: '単量体が結合する反応です。',
      }],
      'signature'
    );

    await savePracticeQuestionAssessment(
      '高分子化学',
      0,
      'review'
    );

    const records = await loadPracticeQuestionRecords();
    const record = records[
      createPracticeQuestionRecordId('高分子化学')
    ];

    expect(record.assessments).toEqual({
      '0': 'review',
    });
  });

  test('問題と解答を編集して自己評価を維持する', async () => {
    const saved = await savePracticeQuestionRecord(
      '高分子化学',
      [{
        question: '重合とは何ですか？',
        answer: '単量体が結合する反応です。',
      }],
      'signature'
    );
    await savePracticeQuestionAssessment(
      '高分子化学',
      0,
      'review'
    );

    const updated = await updatePracticeQuestion(
      '高分子化学',
      0,
      {
        question: ' 付加重合とは何ですか？ ',
        answer: ' 不飽和結合が開く重合反応です。 ',
      }
    );

    expect(updated.questions[0]).toEqual({
      question: '付加重合とは何ですか？',
      answer: '不飽和結合が開く重合反応です。',
    });
    expect(updated.assessments).toEqual({ '0': 'review' });
    expect(updated.sourceSummarySignature).toBe(
      saved.sourceSummarySignature
    );
  });

  test('自己評価と学習位置を続けて保存して両方維持する', async () => {
    await savePracticeQuestionRecord(
      '高分子化学',
      [
        {
          question: '重合とは何ですか？',
          answer: '単量体が結合する反応です。',
        },
        {
          question: '単量体とは何ですか？',
          answer: '重合の材料となる分子です。',
        },
      ],
      'signature'
    );

    await Promise.all([
      savePracticeQuestionAssessment(
        '高分子化学',
        1,
        'known'
      ),
      savePracticeQuestionSession('高分子化学', {
        order: [1, 0],
        currentPosition: 1,
        isFinished: false,
      }),
    ]);

    const record = (await loadPracticeQuestionRecords())[
      createPracticeQuestionRecordId('高分子化学')
    ];

    expect(record.assessments).toEqual({ '1': 'known' });
    expect(record.session).toEqual({
      order: [1, 0],
      currentPosition: 1,
      isFinished: false,
    });
  });

  test('範囲外の学習位置を含む保存データを拒否する', () => {
    const id = createPracticeQuestionRecordId('高分子化学');

    expect(() =>
      parsePracticeQuestionRecords(JSON.stringify({
        [id]: {
          id,
          subject: '高分子化学',
          questions: [{
            question: '重合とは何ですか？',
            answer: '単量体が結合する反応です。',
          }],
          session: {
            order: [1],
            currentPosition: 0,
            isFinished: false,
          },
          sourceSummarySignature: 'signature',
          createdAt: '2026-09-21T10:00:00.000Z',
        },
      }))
    ).toThrow('practiceQuestionRecordsの形式が不正です');
  });
});
