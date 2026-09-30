import {
  buildFlashcardShareMessage,
  buildPracticeQuestionShareMessage,
} from '@/utils/study-material-share';


describe('study material share text', () => {
  test('練習問題と解答を番号付きでまとめる', () => {
    const message = buildPracticeQuestionShareMessage(
      '高分子化学',
      [
        {
          question: '重合とは？',
          answer: '単量体が結合する反応。',
        },
        {
          question: '単量体とは？',
          answer: '高分子の構成単位。',
        },
      ]
    );

    expect(message).toContain('高分子化学の練習問題');
    expect(message).toContain('【第1問】\n重合とは？');
    expect(message).toContain('【第2問】\n単量体とは？');
    expect(message).toContain(
      '【解答】\n高分子の構成単位。'
    );
  });

  test('フラッシュカードの語句と説明を番号付きでまとめる', () => {
    const message = buildFlashcardShareMessage(
      '高分子化学',
      [{
        term: '付加重合',
        definition: '不飽和結合が開く重合反応。',
      }]
    );

    expect(message).toContain(
      '高分子化学のフラッシュカード'
    );
    expect(message).toContain('【カード1】\n付加重合');
    expect(message).toContain(
      '【説明】\n不飽和結合が開く重合反応。'
    );
  });
});
