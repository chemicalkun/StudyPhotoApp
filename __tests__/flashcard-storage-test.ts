import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadFlashcardRecords,
  saveFlashcardAssessment,
  saveFlashcardRecord,
  saveFlashcardSession,
  updateFlashcard,
} from '@/services/flashcard-storage';
import {
  createFlashcardRecordId,
  createFlashcardSourceSignature,
  parseFlashcardRecords,
} from '@/types/flashcard';


describe('flashcard storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('科目ごとのフラッシュカードを保存して読み込む', async () => {
    const signature = createFlashcardSourceSignature([
      {
        id: '["高分子化学","2026-09-21"]',
        createdAt: '2026-09-21T10:00:00.000Z',
      },
    ]);
    const saved = await saveFlashcardRecord(
      '高分子化学',
      [{
        term: '重合',
        definition: '単量体が結合して高分子になる反応。',
      }],
      signature
    );
    const records = await loadFlashcardRecords();

    expect(saved.id).toBe(
      createFlashcardRecordId('高分子化学')
    );
    expect(records[saved.id]).toEqual(saved);
  });

  test('不正な保存データを拒否する', () => {
    expect(() =>
      parseFlashcardRecords(JSON.stringify({
        invalid: {
          id: 'invalid',
          subject: '高分子化学',
          cards: [],
          sourceSummarySignature: 'signature',
          createdAt: 'invalid',
        },
      }))
    ).toThrow('flashcardRecordsの形式が不正です');
  });

  test('カードごとの自己評価を保存する', async () => {
    await saveFlashcardRecord(
      '高分子化学',
      [{
        term: '重合',
        definition: '単量体が結合して高分子になる反応。',
      }],
      'signature'
    );

    await saveFlashcardAssessment(
      '高分子化学',
      0,
      'review'
    );

    const records = await loadFlashcardRecords();
    const record = records[
      createFlashcardRecordId('高分子化学')
    ];

    expect(record.assessments).toEqual({
      '0': 'review',
    });
  });

  test('カードを編集して自己評価を維持する', async () => {
    const saved = await saveFlashcardRecord(
      '高分子化学',
      [{
        term: '重合',
        definition: '単量体が結合する反応。',
      }],
      'signature'
    );
    await saveFlashcardAssessment('高分子化学', 0, 'review');

    const updated = await updateFlashcard(
      '高分子化学',
      0,
      {
        term: ' 付加重合 ',
        definition: ' 不飽和結合が開いて連鎖的に結合する反応。 ',
      }
    );

    expect(updated.cards[0]).toEqual({
      term: '付加重合',
      definition: '不飽和結合が開いて連鎖的に結合する反応。',
    });
    expect(updated.assessments).toEqual({ '0': 'review' });
    expect(updated.sourceSummarySignature).toBe(
      saved.sourceSummarySignature
    );
  });

  test('自己評価と学習位置を続けて保存して両方維持する', async () => {
    await saveFlashcardRecord(
      '高分子化学',
      [
        {
          term: '重合',
          definition: '単量体が結合する反応。',
        },
        {
          term: '単量体',
          definition: '重合の材料となる分子。',
        },
      ],
      'signature'
    );

    await Promise.all([
      saveFlashcardAssessment(
        '高分子化学',
        1,
        'review'
      ),
      saveFlashcardSession('高分子化学', {
        currentRound: [1, 0],
        remaining: [],
        currentPosition: 1,
        currentRoundNumber: 1,
        totalRoundCount: 1,
        isFinished: false,
      }),
    ]);

    const record = (await loadFlashcardRecords())[
      createFlashcardRecordId('高分子化学')
    ];

    expect(record.assessments).toEqual({ '1': 'review' });
    expect(record.session).toEqual({
      currentRound: [1, 0],
      remaining: [],
      currentPosition: 1,
      currentRoundNumber: 1,
      totalRoundCount: 1,
      isFinished: false,
    });
  });

  test('重複したカード位置を含む保存データを拒否する', () => {
    const id = createFlashcardRecordId('高分子化学');

    expect(() =>
      parseFlashcardRecords(JSON.stringify({
        [id]: {
          id,
          subject: '高分子化学',
          cards: [
            {
              term: '重合',
              definition: '単量体が結合する反応。',
            },
            {
              term: '単量体',
              definition: '重合の材料となる分子。',
            },
          ],
          session: {
            currentRound: [0],
            remaining: [0],
            currentPosition: 0,
            currentRoundNumber: 1,
            totalRoundCount: 1,
            isFinished: false,
          },
          sourceSummarySignature: 'signature',
          createdAt: '2026-09-21T10:00:00.000Z',
        },
      }))
    ).toThrow('flashcardRecordsの形式が不正です');
  });
});
