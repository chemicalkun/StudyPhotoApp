import {
  buildExamPreparationSource,
} from '@/types/exam-preparation';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


const createSummary = (
  dateKey: string,
  text: string
): LectureSummaryRecord => ({
  id: JSON.stringify(['有機化学', dateKey]),
  subject: '有機化学',
  dateKey,
  text,
  sourceOcrSignature: `signature-${dateKey}`,
  createdAt: `${dateKey}T12:00:00.000Z`,
});


describe('exam preparation source', () => {
  test('授業回を撮影日順にまとめる', () => {
    const source = buildExamPreparationSource([
      createSummary('2026-05-15', '第2回の内容'),
      createSummary('2026-05-08', '第1回の内容'),
    ]);

    expect(source).toContain('第1回（2026-05-08）');
    expect(source).toContain('第2回（2026-05-15）');
    expect(source.indexOf('第1回の内容')).toBeLessThan(
      source.indexOf('第2回の内容')
    );
  });

  test('指定した文字数に収まるよう各回を均等に含める', () => {
    const source = buildExamPreparationSource([
      createSummary('2026-05-08', 'A'.repeat(200)),
      createSummary('2026-05-15', 'B'.repeat(200)),
      createSummary('2026-05-22', 'C'.repeat(200)),
    ], 180);

    expect(source.length).toBeLessThanOrEqual(180);
    expect(source).toContain('A');
    expect(source).toContain('B');
    expect(source).toContain('C');
  });

  test('まとめがない場合は空文字を返す', () => {
    expect(buildExamPreparationSource([])).toBe('');
  });
});
