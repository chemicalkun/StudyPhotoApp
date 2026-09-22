import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createExamPreparationRecordId,
  createExamPreparationSourceSignature,
  parseExamPreparationRecords,
} from '@/types/exam-preparation';
import {
  createFlashcardRecordId,
  createFlashcardSourceSignature,
  parseFlashcardRecords,
} from '@/types/flashcard';
import {
  createLectureSummaryId,
  parseLectureSummaryRecords,
} from '@/types/lecture-summary';
import {
  createPracticeQuestionRecordId,
  createPracticeQuestionSourceSignature,
  parsePracticeQuestionRecords,
} from '@/types/practice-question';
import {
  createSubjectQuestionSourceSignature,
  parseSubjectQuestionRecords,
} from '@/types/subject-question';
import {
  areSameSubjectNames,
  normalizeSubjectName,
} from '@/utils/timetable-subject';


const subjectLearningStorageKeys = [
  'lectureSummaryRecords',
  'examPreparationRecords',
  'practiceQuestionRecords',
  'flashcardRecords',
  'subjectQuestionRecords',
] as const;


const restoreEntries = async (
  entries: readonly (readonly [string, string | null])[]
) => {
  const entriesToRestore = entries.flatMap(([key, value]) =>
    value === null ? [] : [[key, value] as const]
  );
  const keysToRemove = entries.flatMap(([key, value]) =>
    value === null ? [key] : []
  );

  if (entriesToRestore.length > 0) {
    await AsyncStorage.multiSet(entriesToRestore);
  }

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
};


export const renameSubjectLearningData = async (
  previousSubject: string,
  nextSubject: string
) => {
  const normalizedPreviousSubject = previousSubject.trim();
  const normalizedNextSubject = nextSubject.trim();

  if (
    normalizedPreviousSubject === '' ||
    normalizedNextSubject === '' ||
    normalizeSubjectName(normalizedPreviousSubject) ===
      normalizeSubjectName(normalizedNextSubject)
  ) {
    throw new Error('授業名の変更内容が不正です');
  }

  const originalEntries = await AsyncStorage.multiGet([
    ...subjectLearningStorageKeys,
  ]);
  const originalValues = Object.fromEntries(originalEntries);
  const lectureSummaryRecords = originalValues.lectureSummaryRecords === null
    ? {}
    : parseLectureSummaryRecords(
        originalValues.lectureSummaryRecords
      );
  const examPreparationRecords = originalValues.examPreparationRecords === null
    ? {}
    : parseExamPreparationRecords(
        originalValues.examPreparationRecords
      );
  const practiceQuestionRecords = originalValues.practiceQuestionRecords === null
    ? {}
    : parsePracticeQuestionRecords(
        originalValues.practiceQuestionRecords
      );
  const flashcardRecords = originalValues.flashcardRecords === null
    ? {}
    : parseFlashcardRecords(originalValues.flashcardRecords);
  const subjectQuestionRecords = originalValues.subjectQuestionRecords === null
    ? {}
    : parseSubjectQuestionRecords(
        originalValues.subjectQuestionRecords
      );
  const nextLectureSummaryRecords = {
    ...lectureSummaryRecords,
  };
  let updatedRecordCount = 0;
  let updatedLectureSummaryCount = 0;

  Object.values(lectureSummaryRecords)
    .filter(
      (record) =>
        areSameSubjectNames(
          record.subject,
          normalizedPreviousSubject
        )
    )
    .forEach((record) => {
      const nextId = createLectureSummaryId(
        normalizedNextSubject,
        record.dateKey
      );
      const conflictingRecord = Object.values(
        nextLectureSummaryRecords
      ).find(
        (candidate) =>
          candidate.id !== record.id &&
          candidate.dateKey === record.dateKey &&
          areSameSubjectNames(
            candidate.subject,
            normalizedNextSubject
          )
      );

      if (
        conflictingRecord !== undefined &&
        conflictingRecord.id !== record.id
      ) {
        throw new Error(
          '変更後の授業名に同じ日のまとめがあります'
        );
      }

      delete nextLectureSummaryRecords[record.id];
      nextLectureSummaryRecords[nextId] = {
        ...record,
        id: nextId,
        subject: normalizedNextSubject,
      };
      updatedRecordCount += 1;
      updatedLectureSummaryCount += 1;
    });

  const nextSubjectSummaries = Object.values(
    nextLectureSummaryRecords
  ).filter(
    (record) =>
      areSameSubjectNames(
        record.subject,
        normalizedNextSubject
      )
  );
  const examPreparationSourceSignature =
    createExamPreparationSourceSignature(
      nextSubjectSummaries
    );
  const practiceQuestionSourceSignature =
    createPracticeQuestionSourceSignature(
      nextSubjectSummaries
    );
  const flashcardSourceSignature =
    createFlashcardSourceSignature(nextSubjectSummaries);
  const subjectQuestionSourceSignature =
    createSubjectQuestionSourceSignature(
      nextSubjectSummaries
    );
  const nextExamPreparationRecords = {
    ...examPreparationRecords,
  };
  const previousExamPreparationEntry = Object.entries(
    nextExamPreparationRecords
  ).find(([, record]) =>
    areSameSubjectNames(
      record.subject,
      normalizedPreviousSubject
    )
  );
  const previousExamPreparationId =
    previousExamPreparationEntry?.[0];
  const previousExamPreparation =
    previousExamPreparationEntry?.[1];

  if (previousExamPreparation !== undefined) {
    const nextId = createExamPreparationRecordId(
      normalizedNextSubject
    );

    const conflictingRecord = Object.values(
      nextExamPreparationRecords
    ).find(
      (record) =>
        record.id !== previousExamPreparation.id &&
        areSameSubjectNames(
          record.subject,
          normalizedNextSubject
        )
    );

    if (conflictingRecord !== undefined) {
      throw new Error(
        '変更後の授業名に試験対策があります'
      );
    }

    delete nextExamPreparationRecords[
      previousExamPreparationId as string
    ];
    nextExamPreparationRecords[nextId] = {
      ...previousExamPreparation,
      id: nextId,
      subject: normalizedNextSubject,
      sourceSummarySignature:
        examPreparationSourceSignature,
    };
    updatedRecordCount += 1;
  }

  const nextPracticeQuestionRecords = {
    ...practiceQuestionRecords,
  };
  const previousPracticeQuestionEntry = Object.entries(
    nextPracticeQuestionRecords
  ).find(([, record]) =>
    areSameSubjectNames(
      record.subject,
      normalizedPreviousSubject
    )
  );
  const previousPracticeQuestionId =
    previousPracticeQuestionEntry?.[0];
  const previousPracticeQuestions =
    previousPracticeQuestionEntry?.[1];

  if (previousPracticeQuestions !== undefined) {
    const nextId = createPracticeQuestionRecordId(
      normalizedNextSubject
    );

    const conflictingRecord = Object.values(
      nextPracticeQuestionRecords
    ).find(
      (record) =>
        record.id !== previousPracticeQuestions.id &&
        areSameSubjectNames(
          record.subject,
          normalizedNextSubject
        )
    );

    if (conflictingRecord !== undefined) {
      throw new Error(
        '変更後の授業名に練習問題があります'
      );
    }

    delete nextPracticeQuestionRecords[
      previousPracticeQuestionId as string
    ];
    nextPracticeQuestionRecords[nextId] = {
      ...previousPracticeQuestions,
      id: nextId,
      subject: normalizedNextSubject,
      sourceSummarySignature:
        practiceQuestionSourceSignature,
    };
    updatedRecordCount += 1;
  }

  const nextFlashcardRecords = { ...flashcardRecords };
  const previousFlashcardEntry = Object.entries(
    nextFlashcardRecords
  ).find(([, record]) =>
    areSameSubjectNames(
      record.subject,
      normalizedPreviousSubject
    )
  );
  const previousFlashcardId =
    previousFlashcardEntry?.[0];
  const previousFlashcards =
    previousFlashcardEntry?.[1];

  if (previousFlashcards !== undefined) {
    const nextId = createFlashcardRecordId(
      normalizedNextSubject
    );

    const conflictingRecord = Object.values(
      nextFlashcardRecords
    ).find(
      (record) =>
        record.id !== previousFlashcards.id &&
        areSameSubjectNames(
          record.subject,
          normalizedNextSubject
        )
    );

    if (conflictingRecord !== undefined) {
      throw new Error(
        '変更後の授業名にフラッシュカードがあります'
      );
    }

    delete nextFlashcardRecords[
      previousFlashcardId as string
    ];
    nextFlashcardRecords[nextId] = {
      ...previousFlashcards,
      id: nextId,
      subject: normalizedNextSubject,
      sourceSummarySignature: flashcardSourceSignature,
    };
    updatedRecordCount += 1;
  }

  const nextSubjectQuestionRecords = Object.fromEntries(
    Object.entries(subjectQuestionRecords).map(
      ([recordId, record]) => {
        if (
          !areSameSubjectNames(
            record.subject,
            normalizedPreviousSubject
          )
        ) {
          return [recordId, record];
        }

        updatedRecordCount += 1;

        return [
          recordId,
          {
            ...record,
            subject: normalizedNextSubject,
            sourceSummarySignature:
              subjectQuestionSourceSignature,
          },
        ];
      }
    )
  );
  const updatedEntries = [
    [
      'lectureSummaryRecords',
      JSON.stringify(nextLectureSummaryRecords),
    ],
    [
      'examPreparationRecords',
      JSON.stringify(nextExamPreparationRecords),
    ],
    [
      'practiceQuestionRecords',
      JSON.stringify(nextPracticeQuestionRecords),
    ],
    [
      'flashcardRecords',
      JSON.stringify(nextFlashcardRecords),
    ],
    [
      'subjectQuestionRecords',
      JSON.stringify(nextSubjectQuestionRecords),
    ],
  ] as const;

  try {
    if (updatedRecordCount > 0) {
      await AsyncStorage.multiSet(updatedEntries);

      const savedLectureSummaries =
        await AsyncStorage.getItem(
          'lectureSummaryRecords'
        );
      const savedLectureSummaryRecords =
        savedLectureSummaries === null
          ? {}
          : parseLectureSummaryRecords(
              savedLectureSummaries
            );
      const previousSubjectRemains = Object.values(
        savedLectureSummaryRecords
      ).some((record) =>
        areSameSubjectNames(
          record.subject,
          normalizedPreviousSubject
        )
      );

      if (previousSubjectRemains) {
        throw new Error(
          '変更前の授業名のまとめが残っています'
        );
      }
    }
  } catch (error) {
    await restoreEntries(originalEntries);
    throw error;
  }

  return {
    updatedRecordCount,
    updatedLectureSummaryCount,
    rollback: () => restoreEntries(originalEntries),
  };
};
