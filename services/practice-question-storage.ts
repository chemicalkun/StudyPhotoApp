import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createPracticeQuestionRecordId,
  parsePracticeQuestionRecords,
  type PracticeQuestion,
  type PracticeQuestionAssessment,
  type PracticeQuestionRecord,
  type PracticeQuestionRecords,
  type PracticeQuestionSession,
} from '@/types/practice-question';


const practiceQuestionStorageKey =
  'practiceQuestionRecords';
let mutationQueue: Promise<void> = Promise.resolve();


const loadPracticeQuestionRecordsFromStorage = async () => {
  const savedRecords = await AsyncStorage.getItem(
    practiceQuestionStorageKey
  );

  if (savedRecords === null) {
    return {};
  }

  return parsePracticeQuestionRecords(savedRecords);
};


export const loadPracticeQuestionRecords = async () => {
  await mutationQueue;

  return loadPracticeQuestionRecordsFromStorage();
};


const savePracticeQuestionRecords = async (
  records: PracticeQuestionRecords
) => {
  await AsyncStorage.setItem(
    practiceQuestionStorageKey,
    JSON.stringify(records)
  );
};


const mutatePracticeQuestionRecords = <Result>(
  mutation: (
    records: PracticeQuestionRecords
  ) => {
    records: PracticeQuestionRecords;
    result: Result;
  }
): Promise<Result> => {
  const operation = mutationQueue.then(async () => {
    const records =
      await loadPracticeQuestionRecordsFromStorage();
    const mutationResult = mutation(records);

    await savePracticeQuestionRecords(mutationResult.records);

    return mutationResult.result;
  });

  mutationQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
};


export const savePracticeQuestionRecord = async (
  subject: string,
  questions: PracticeQuestion[],
  sourceSummarySignature: string,
  session?: PracticeQuestionSession
): Promise<PracticeQuestionRecord> => {
  if (
    subject === '' ||
    questions.length === 0 ||
    sourceSummarySignature === ''
  ) {
    throw new Error('保存する練習問題がありません');
  }

  const id = createPracticeQuestionRecordId(subject);
  const record: PracticeQuestionRecord = {
    id,
    subject,
    questions,
    assessments: {},
    session,
    sourceSummarySignature,
    createdAt: new Date().toISOString(),
  };

  return mutatePracticeQuestionRecords((records) => ({
    records: {
      ...records,
      [id]: record,
    },
    result: record,
  }));
};


export const savePracticeQuestionSession = async (
  subject: string,
  session: PracticeQuestionSession
) => {
  if (subject === '') {
    throw new Error('保存する学習位置が不正です');
  }

  return mutatePracticeQuestionRecords((records) => {
    const id = createPracticeQuestionRecordId(subject);
    const record = records[id];

    if (record === undefined) {
      throw new Error('練習問題が見つかりません');
    }

    const updatedRecord: PracticeQuestionRecord = {
      ...record,
      session,
    };

    return {
      records: {
        ...records,
        [id]: updatedRecord,
      },
      result: updatedRecord,
    };
  });
};


export const savePracticeQuestionAssessment = async (
  subject: string,
  questionIndex: number,
  assessment: PracticeQuestionAssessment
) => {
  if (
    subject === '' ||
    !Number.isInteger(questionIndex) ||
    questionIndex < 0
  ) {
    throw new Error('保存する回答記録が不正です');
  }

  return mutatePracticeQuestionRecords((records) => {
    const id = createPracticeQuestionRecordId(subject);
    const record = records[id];

    if (
      record === undefined ||
      questionIndex >= record.questions.length
    ) {
      throw new Error('練習問題が見つかりません');
    }

    const updatedRecord: PracticeQuestionRecord = {
      ...record,
      assessments: {
        ...record.assessments,
        [String(questionIndex)]: assessment,
      },
    };

    return {
      records: {
        ...records,
        [id]: updatedRecord,
      },
      result: updatedRecord,
    };
  });
};


export const updatePracticeQuestion = async (
  subject: string,
  questionIndex: number,
  question: PracticeQuestion
) => {
  const questionText = question.question.trim();
  const answer = question.answer.trim();

  if (
    subject === '' ||
    !Number.isInteger(questionIndex) ||
    questionIndex < 0 ||
    questionText === '' ||
    answer === ''
  ) {
    throw new Error('保存する練習問題が不正です');
  }

  return mutatePracticeQuestionRecords((records) => {
    const id = createPracticeQuestionRecordId(subject);
    const record = records[id];

    if (
      record === undefined ||
      questionIndex >= record.questions.length
    ) {
      throw new Error('練習問題が見つかりません');
    }

    const updatedQuestions = [...record.questions];
    updatedQuestions[questionIndex] = {
      question: questionText,
      answer,
    };

    const updatedRecord: PracticeQuestionRecord = {
      ...record,
      questions: updatedQuestions,
      createdAt: new Date().toISOString(),
    };

    return {
      records: {
        ...records,
        [id]: updatedRecord,
      },
      result: updatedRecord,
    };
  });
};
