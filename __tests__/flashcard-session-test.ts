import {
  createFlashcardSession,
  shuffleFlashcardIndexes,
  takeNextFlashcardRound,
} from '@/utils/flashcard-session';


describe('flashcard session', () => {
  test('元の順番を変更せずカードをランダムに並べる', () => {
    const original = [0, 1, 2, 3];
    const randomValues = [0.1, 0.7, 0.2];
    let randomIndex = 0;

    const shuffled = shuffleFlashcardIndexes(
      original,
      () => randomValues[randomIndex++] ?? 0
    );

    expect(shuffled).not.toEqual(original);
    expect([...shuffled].sort()).toEqual(original);
    expect(original).toEqual([0, 1, 2, 3]);
  });

  test('5枚ずつのセットに分ける', () => {
    const session = createFlashcardSession(
      [0, 1, 2, 3, 4, 5, 6, 7],
      () => 0.5
    );

    expect(session.currentRound).toHaveLength(5);
    expect(session.remaining).toHaveLength(3);
    expect(session.totalRounds).toBe(2);
    expect([
      ...session.currentRound,
      ...session.remaining,
    ].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const nextRound = takeNextFlashcardRound(
      session.remaining
    );

    expect(nextRound.currentRound).toHaveLength(3);
    expect(nextRound.remaining).toEqual([]);
  });
});
