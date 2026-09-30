import {
  createLectureSummaryId,
  createLectureSummarySourceSignature,
} from '@/types/lecture-summary';
import type { PhotoRecord } from '@/types/photo';
import {
  buildSubjectReviewProgress,
  getOverallLearningCompletion,
  getSubjectLearningCompletion,
  getSubjectReviewPendingCount,
  sortSubjectReviewProgressByAttention,
  subjectNeedsAttention,
} from '@/utils/review-progress';


const createPhoto = (
  id: string,
  takenAt: string,
  isImportant = false
): PhotoRecord => ({
  id,
  uri: `file:///${id}.jpg`,
  takenAt,
  day: '月',
  period: 2,
  subject: '有機化学',
  isImportant,
});


describe('review progress', () => {
  test('練習問題とカードの定着度を計算する', () => {
    const baseProgress = {
      subject: '有機化学',
      practiceKnownCount: 2,
      practiceReviewCount: 1,
      practiceUnansweredCount: 1,
      practiceIsOutdated: false,
      flashcardKnownCount: 1,
      flashcardReviewCount: 1,
      flashcardUnansweredCount: 0,
      flashcardsAreOutdated: false,
      examPreparationIsMissing: false,
      examPreparationIsOutdated: false,
      importantPhotoCount: 0,
      notedPhotoCount: 0,
      currentSummaryCount: 0,
      outdatedSummaryCount: 0,
      missingSummaryCount: 0,
    };

    expect(getSubjectLearningCompletion(baseProgress)).toEqual({
      knownCount: 3,
      itemCount: 6,
      percentage: 50,
    });
    expect(getSubjectLearningCompletion({
      ...baseProgress,
      practiceKnownCount: 0,
      practiceReviewCount: 0,
      practiceUnansweredCount: 0,
      flashcardKnownCount: 0,
      flashcardReviewCount: 0,
    })).toEqual({
      knownCount: 0,
      itemCount: 0,
      percentage: null,
    });
  });

  test('全授業の定着度を合算する', () => {
    const createProgress = (
      subject: string,
      knownCount: number,
      reviewCount: number,
      unansweredCount: number
    ) => ({
      subject,
      practiceKnownCount: knownCount,
      practiceReviewCount: reviewCount,
      practiceUnansweredCount: unansweredCount,
      practiceIsOutdated: false,
      flashcardKnownCount: 0,
      flashcardReviewCount: 0,
      flashcardUnansweredCount: 0,
      flashcardsAreOutdated: false,
      examPreparationIsMissing: false,
      examPreparationIsOutdated: false,
      importantPhotoCount: 0,
      notedPhotoCount: 0,
      currentSummaryCount: 0,
      outdatedSummaryCount: 0,
      missingSummaryCount: 0,
    });

    expect(getOverallLearningCompletion([
      createProgress('有機化学', 2, 1, 1),
      createProgress('高分子化学', 1, 1, 0),
    ])).toEqual({
      knownCount: 3,
      itemCount: 6,
      remainingCount: 3,
      percentage: 50,
    });
    expect(getOverallLearningCompletion([])).toEqual({
      knownCount: 0,
      itemCount: 0,
      remainingCount: 0,
      percentage: null,
    });
  });

  test('未作成と定着度の低い授業を優先順に並べる', () => {
    const createProgress = (
      subject: string,
      knownCount: number,
      reviewCount: number,
      missingSummaryCount = 0
    ) => ({
      subject,
      practiceKnownCount: knownCount,
      practiceReviewCount: reviewCount,
      practiceUnansweredCount: 0,
      practiceIsOutdated: false,
      flashcardKnownCount: 0,
      flashcardReviewCount: 0,
      flashcardUnansweredCount: 0,
      flashcardsAreOutdated: false,
      examPreparationIsMissing: false,
      examPreparationIsOutdated: false,
      importantPhotoCount: 0,
      notedPhotoCount: 0,
      currentSummaryCount: 0,
      outdatedSummaryCount: 0,
      missingSummaryCount,
    });
    const progressItems = [
      createProgress('定着度百', 2, 0),
      createProgress('未作成', 0, 0, 1),
      createProgress('定着度半分', 1, 1),
    ];

    expect(
      sortSubjectReviewProgressByAttention(progressItems)
        .map((progress) => progress.subject)
    ).toEqual([
      '未作成',
      '定着度半分',
      '定着度百',
    ]);
    expect(progressItems.map((progress) => progress.subject))
      .toEqual([
        '定着度百',
        '未作成',
        '定着度半分',
      ]);
  });

  test('まとめや学習項目の対応が残る授業を判定する', () => {
    const completedProgress = {
      subject: '有機化学',
      practiceKnownCount: 2,
      practiceReviewCount: 0,
      practiceUnansweredCount: 0,
      practiceIsOutdated: false,
      flashcardKnownCount: 2,
      flashcardReviewCount: 0,
      flashcardUnansweredCount: 0,
      flashcardsAreOutdated: false,
      examPreparationIsMissing: false,
      examPreparationIsOutdated: false,
      importantPhotoCount: 1,
      notedPhotoCount: 1,
      currentSummaryCount: 2,
      outdatedSummaryCount: 0,
      missingSummaryCount: 0,
    };

    expect(subjectNeedsAttention(completedProgress)).toBe(false);
    expect(subjectNeedsAttention({
      ...completedProgress,
      practiceUnansweredCount: 1,
    })).toBe(true);
    expect(subjectNeedsAttention({
      ...completedProgress,
      outdatedSummaryCount: 1,
    })).toBe(true);
    expect(subjectNeedsAttention({
      ...completedProgress,
      flashcardKnownCount: 0,
    })).toBe(true);
    expect(subjectNeedsAttention({
      ...completedProgress,
      practiceIsOutdated: true,
    })).toBe(true);
    expect(subjectNeedsAttention({
      ...completedProgress,
      examPreparationIsMissing: true,
    })).toBe(true);
  });

  test('復習待ちの合計件数を計算する', () => {
    const progress = {
      subject: '有機化学',
      practiceKnownCount: 1,
      practiceReviewCount: 2,
      practiceUnansweredCount: 1,
      practiceIsOutdated: false,
      flashcardKnownCount: 3,
      flashcardReviewCount: 4,
      flashcardUnansweredCount: 2,
      flashcardsAreOutdated: false,
      examPreparationIsMissing: false,
      examPreparationIsOutdated: false,
      importantPhotoCount: 5,
      notedPhotoCount: 6,
      currentSummaryCount: 7,
      outdatedSummaryCount: 8,
      missingSummaryCount: 9,
    };

    expect(getSubjectReviewPendingCount(progress)).toBe(14);
    expect(getSubjectReviewPendingCount({
      ...progress,
      practiceIsOutdated: true,
      flashcardsAreOutdated: true,
    })).toBe(7);
    expect(getSubjectReviewPendingCount({
      ...progress,
      examPreparationIsOutdated: true,
    })).toBe(15);
  });

  test('試験対策データの読み込み前でも集計できる', () => {
    expect(buildSubjectReviewProgress({
      summaries: [],
      photos: [],
      photoOcrRecords: {},
      practiceQuestionRecords: {},
      flashcardRecords: {},
    })).toEqual([]);
  });

  test('授業ごとの復習待ちとまとめ状態を集計する', () => {
    const photos = [
      createPhoto(
        'photo-1',
        '2026-09-21T01:00:00.000Z',
        true
      ),
      createPhoto(
        'photo-2',
        '2026-09-28T01:00:00.000Z'
      ),
      createPhoto(
        'photo-3',
        '2026-10-05T01:00:00.000Z',
        true
      ),
    ];
    photos[0].note = '反応機構を見直す';
    photos[2].importantReviewedAt =
      '2026-10-06T01:00:00.000Z';
    const firstSummaryId = createLectureSummaryId(
      '有機化学',
      '2026-9-21'
    );
    const secondSummaryId = createLectureSummaryId(
      '有機化学',
      '2026-9-28'
    );
    const photoOcrRecords = {
      'photo-1': {
        photoId: 'photo-1',
        text: 'アルケンへの付加反応',
        blocks: [],
        recognizedAt: '2026-09-21T02:00:00.000Z',
      },
      'photo-2': {
        photoId: 'photo-2',
        text: '置換反応',
        blocks: [],
        recognizedAt: '2026-09-28T03:00:00.000Z',
      },
    };
    const summaries = [
      {
        id: firstSummaryId,
        subject: '有機化学',
        dateKey: '2026-9-21',
        text: '第1回まとめ',
        sourceOcrSignature:
          createLectureSummarySourceSignature([
            {
              ...photoOcrRecords['photo-1'],
              note: '反応機構を見直す',
            },
          ]),
        createdAt: '2026-09-21T03:00:00.000Z',
      },
      {
        id: secondSummaryId,
        subject: '有機化学',
        dateKey: '2026-9-28',
        text: '第2回まとめ',
        sourceOcrSignature:
          createLectureSummarySourceSignature([
            {
              photoId: 'photo-2',
              recognizedAt: '2026-09-28T02:00:00.000Z',
            },
          ]),
        createdAt: '2026-09-28T03:00:00.000Z',
      },
    ];
    const progress = buildSubjectReviewProgress({
      summaries,
      photos,
      photoOcrRecords,
      practiceQuestionRecords: {
        '["有機化学"]': {
          id: '["有機化学"]',
          subject: '有機化学',
          questions: [
            { question: '問題1', answer: '解答1' },
            { question: '問題2', answer: '解答2' },
            { question: '問題3', answer: '解答3' },
          ],
          assessments: {
            '0': 'known',
            '1': 'review',
          },
          sourceSummarySignature: 'signature',
          createdAt: '2026-09-28T04:00:00.000Z',
        },
      },
      flashcardRecords: {
        '["有機化学"]': {
          id: '["有機化学"]',
          subject: '有機化学',
          cards: [
            { term: '求電子剤', definition: '電子を受け取る' },
            { term: '求核剤', definition: '電子を与える' },
            { term: '親電子剤', definition: '電子密度の高い種' },
          ],
          assessments: {
            '0': 'review',
            '1': 'review',
          },
          sourceSummarySignature: 'signature',
          createdAt: '2026-09-28T04:00:00.000Z',
        },
      },
      examPreparationRecords: {
        '["有機化学"]': {
          id: '["有機化学"]',
          subject: '有機化学',
          text: '試験対策',
          sourceSummarySignature: 'signature',
          createdAt: '2026-09-28T04:00:00.000Z',
        },
      },
    });

    expect(progress).toEqual([
      {
        subject: '有機化学',
        practiceKnownCount: 1,
        practiceReviewCount: 1,
        practiceUnansweredCount: 1,
        practiceIsOutdated: true,
        flashcardKnownCount: 0,
        flashcardReviewCount: 2,
        flashcardUnansweredCount: 1,
        flashcardsAreOutdated: true,
        examPreparationIsMissing: false,
        examPreparationIsOutdated: true,
        importantPhotoCount: 1,
        notedPhotoCount: 1,
        currentSummaryCount: 1,
        outdatedSummaryCount: 1,
        missingSummaryCount: 1,
      },
    ]);
  });
});
