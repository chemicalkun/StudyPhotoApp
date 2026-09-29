import {
  createLectureSummaryId,
  createLectureSummarySourceSignature,
} from '@/types/lecture-summary';
import type { PhotoRecord } from '@/types/photo';
import { buildSubjectReviewProgress } from '@/utils/review-progress';


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
            photoOcrRecords['photo-1'],
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
          ],
          assessments: {
            '0': 'review',
            '1': 'review',
          },
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
        flashcardKnownCount: 0,
        flashcardReviewCount: 2,
        importantPhotoCount: 2,
        currentSummaryCount: 1,
        outdatedSummaryCount: 1,
        missingSummaryCount: 1,
      },
    ]);
  });
});
