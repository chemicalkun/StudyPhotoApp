import {
  deduplicatePositionedTextBlocks,
  normalizeTimetableText,
  parseTimetableCandidates,
  PositionedTextBlock,
} from '@/utils/timetable-recognition';


const createBlock = (
  text: string,
  x: number,
  y: number,
  confidence = 0.9,
  width = 0.08,
  height = 0.04
): PositionedTextBlock => ({
  text,
  confidence,
  boundingBox: { x, y, width, height },
});


describe('parseTimetableCandidates', () => {
  test('画像内の位置から曜日・時限・科目を割り当てる', () => {
    const result = parseTimetableCandidates([
      createBlock('月', 0.25, 0.9),
      createBlock('火曜日', 0.55, 0.9),
      createBlock('1限', 0.05, 0.7),
      createBlock('2', 0.05, 0.4),
      createBlock('英語', 0.25, 0.7, 0.96),
      createBlock('情報処理', 0.55, 0.4, 0.88),
    ]);

    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 1,
        subject: '英語',
        confidence: 0.96,
      },
      {
        day: '火',
        period: 2,
        subject: '情報処理',
        confidence: 0.88,
      },
    ]);
    expect(result.warning).toBeNull();
  });

  test('同じマスの複数行を1つの科目候補にまとめる', () => {
    const result = parseTimetableCandidates([
      createBlock('月', 0.25, 0.9),
      createBlock('火', 0.55, 0.9),
      createBlock('1', 0.05, 0.7),
      createBlock('2', 0.05, 0.4),
      createBlock('基礎', 0.25, 0.72, 0.8),
      createBlock('化学', 0.25, 0.66, 1),
    ]);

    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 1,
        subject: '基礎化学',
        confidence: 0.9,
      },
    ]);
  });

  test('曜日が1つの文字領域にまとまっていても検出する', () => {
    const result = parseTimetableCandidates([
      createBlock('月 火 水 木 金 土', 0.2, 0.9, 0.9, 0.7),
      createBlock('1限', 0.05, 0.7),
      createBlock('2限', 0.05, 0.4),
      createBlock('数学', 0.27, 0.7),
    ]);

    expect(result.detectedDays).toEqual([
      '月',
      '火',
      '水',
      '木',
      '金',
      '土',
    ]);
    expect(result.candidates[0]).toMatchObject({
      day: '月',
      period: 1,
      subject: '数学',
    });
  });

  test('6限と第・時限・コマ付きの表記を検出する', () => {
    const result = parseTimetableCandidates([
      createBlock('月', 0.25, 0.9),
      createBlock('火', 0.55, 0.9),
      createBlock('第5時限', 0.05, 0.7),
      createBlock('６コマ', 0.05, 0.4),
      createBlock('卒業研究', 0.25, 0.4),
    ]);

    expect(result.detectedPeriods).toEqual([5, 6]);
    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 6,
        subject: '卒業研究',
        confidence: 0.9,
      },
    ]);
  });

  test('時限が1つの縦長文字領域でも各行へ分割する', () => {
    const result = parseTimetableCandidates([
      createBlock('月', 0.25, 0.9),
      createBlock('火', 0.55, 0.9),
      createBlock(
        '1限\n2限\n3限\n4限\n5限\n6限',
        0.05,
        0.15,
        0.9,
        0.08,
        0.72
      ),
      createBlock('物理学', 0.25, 0.69),
      createBlock('化学', 0.55, 0.21),
    ]);

    expect(result.detectedPeriods).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
    ]);
    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 2,
        subject: '物理学',
        confidence: 0.9,
      },
      {
        day: '火',
        period: 6,
        subject: '化学',
        confidence: 0.9,
      },
    ]);
  });

  test('曜日が縦・時限が横の時間割を自動判定する', () => {
    const result = parseTimetableCandidates([
      createBlock(
        '月曜日\n火曜日',
        0.05,
        0.2,
        0.9,
        0.08,
        0.6
      ),
      createBlock(
        '1限 2限',
        0.2,
        0.88,
        0.9,
        0.6,
        0.04
      ),
      createBlock('英語', 0.31, 0.63),
      createBlock('情報処理', 0.61, 0.33),
    ]);

    expect(result.detectedDays).toEqual(['月', '火']);
    expect(result.detectedPeriods).toEqual([1, 2]);
    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 1,
        subject: '英語',
        confidence: 0.9,
      },
      {
        day: '火',
        period: 2,
        subject: '情報処理',
        confidence: 0.9,
      },
    ]);
    expect(result.warning).toBeNull();
  });

  test('表の外側にあるタイトルは科目候補に含めない', () => {
    const result = parseTimetableCandidates([
      createBlock('月', 0.25, 0.9),
      createBlock('火', 0.55, 0.9),
      createBlock('1限', 0.05, 0.7),
      createBlock('2限', 0.05, 0.4),
      createBlock('2026年度 時間割', 0.35, 0.97),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.warning).toContain('科目候補');
  });

  test('曜日と小時限が横並びの時間割を検出する', () => {
    const mondayStart = 0.05;
    const tuesdayStart = 0.35;
    const slotBlocks = [mondayStart, tuesdayStart]
      .flatMap((start) =>
        Array.from({ length: 10 }, (_, index) =>
          createBlock(
            String(index + 1),
            start + index * 0.02,
            0.88,
            0.95,
            0.01,
            0.02
          )
        )
      );
    const result = parseTimetableCandidates([
      createBlock('月', 0.13, 0.94, 0.95, 0.04, 0.02),
      createBlock('火', 0.43, 0.94, 0.95, 0.04, 0.02),
      ...slotBlocks,
      createBlock('数学', 0.055, 0.45, 0.9, 0.03, 0.04),
      createBlock('情報処理', 0.435, 0.45, 0.85, 0.03, 0.04),
    ]);

    expect(result.detectedDays).toEqual(['月', '火']);
    expect(result.detectedPeriods).toEqual([1, 2, 3, 4, 5]);
    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 1,
        subject: '数学',
        confidence: 0.9,
      },
      {
        day: '火',
        period: 3,
        subject: '情報処理',
        confidence: 0.85,
      },
    ]);
    expect(result.warning).toBeNull();
  });

  test('曜日文字が読めなくても1〜10の繰り返しから曜日を推定する', () => {
    const mondayStart = 0.05;
    const tuesdayStart = 0.35;
    const slotBlocks = [mondayStart, tuesdayStart]
      .flatMap((start) =>
        Array.from({ length: 10 }, (_, index) =>
          createBlock(
            String(index + 1),
            start + index * 0.02,
            0.88 + (index % 2) * 0.004,
            0.95,
            0.01,
            0.02
          )
        )
      );
    const result = parseTimetableCandidates([
      ...slotBlocks,
      createBlock('数学', 0.055, 0.45, 0.9, 0.03, 0.04),
      createBlock('2410', 0.055, 0.39, 0.94, 0.02, 0.02),
      createBlock('田中', 0.055, 0.35, 0.92, 0.02, 0.02),
      createBlock('2211', 0.055, 0.31, 0.96, 0.02, 0.02),
      createBlock('情報処理', 0.435, 0.45, 0.85, 0.03, 0.04),
      createBlock('2602', 0.435, 0.39, 0.94, 0.02, 0.02),
      createBlock('佐藤', 0.435, 0.35, 0.91, 0.02, 0.02),
    ]);

    expect(result.detectedDays).toEqual(['月', '火']);
    expect(result.detectedPeriods).toEqual([1, 2, 3, 4, 5]);
    expect(result.candidates).toEqual([
      {
        day: '月',
        period: 1,
        subject: '数学',
        confidence: 0.9,
      },
      {
        day: '火',
        period: 3,
        subject: '情報処理',
        confidence: 0.85,
      },
    ]);
    expect(result.warning).toBeNull();
  });

  test('見出しが不足している場合は推測しない', () => {
    const result = parseTimetableCandidates([
      createBlock('月', 0.25, 0.9),
      createBlock('英語', 0.25, 0.7),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.warning).toContain('曜日');
  });
});


describe('normalizeTimetableText', () => {
  test('日本語と数字の間に入った空白を取り除く', () => {
    expect(normalizeTimetableText('演 習 ２')).toBe('演習２');
  });

  test('英単語同士の空白は残す', () => {
    expect(normalizeTimetableText('Data Science')).toBe(
      'Data Science'
    );
  });
});


describe('deduplicatePositionedTextBlocks', () => {
  test('重なった読み取り範囲の同じ文字を1つにする', () => {
    const blocks = deduplicatePositionedTextBlocks([
      createBlock('月', 0.1, 0.9),
      createBlock('月', 0.101, 0.901),
      createBlock('月', 0.3, 0.9),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].boundingBox.x).toBe(0.1);
    expect(blocks[1].boundingBox.x).toBe(0.3);
  });
});
