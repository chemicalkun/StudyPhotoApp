import type { Flashcard } from '@/types/flashcard';
import type { PracticeQuestion } from '@/types/practice-question';


export const buildPracticeQuestionShareMessage = (
  subject: string,
  questions: PracticeQuestion[]
) => [
  `${subject}の練習問題`,
  ...questions.map(
    (question, index) =>
      `\n【第${index + 1}問】\n${question.question}\n\n【解答】\n${question.answer}`
  ),
].join('\n');


export const buildFlashcardShareMessage = (
  subject: string,
  cards: Flashcard[]
) => [
  `${subject}のフラッシュカード`,
  ...cards.map(
    (card, index) =>
      `\n【カード${index + 1}】\n${card.term}\n\n【説明】\n${card.definition}`
  ),
].join('\n');
