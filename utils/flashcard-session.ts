export const flashcardRoundSize = 5;


export const shuffleFlashcardIndexes = (
  indexes: number[],
  random: () => number = Math.random
) => {
  const shuffled = [...indexes];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];

    if (current === undefined || replacement === undefined) {
      continue;
    }

    shuffled[index] = replacement;
    shuffled[swapIndex] = current;
  }

  return shuffled;
};


export const createFlashcardSession = (
  indexes: number[],
  random: () => number = Math.random
) => {
  const shuffled = shuffleFlashcardIndexes(indexes, random);

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
