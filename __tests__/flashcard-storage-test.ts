import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadFlashcardRecords,
  saveFlashcardAssessment,
  saveFlashcardRecord,
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
});
