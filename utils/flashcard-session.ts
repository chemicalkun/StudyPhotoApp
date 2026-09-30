import { shuffleIndexes } from '@/utils/random-order';


export const flashcardRoundSize = 5;


export const createFlashcardSession = (
  indexes: number[],
  random: () => number = Math.random
) => {
  const shuffled = shuffleIndexes(indexes, random);

  return {
    currentRound: shuffled.slice(0, flashcardRoundSize),
    remaining: shuffled.slice(flashcardRoundSize),
    totalRounds: Math.ceil(
      shuffled.length / flashcardRoundSize
    ),
  };
};


export const takeNextFlashcardRound = (
  remaining: number[]
) => ({
  currentRound: remaining.slice(0, flashcardRoundSize),
  remaining: remaining.slice(flashcardRoundSize),
});
