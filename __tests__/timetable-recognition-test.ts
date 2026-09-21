import {
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
      createBlock('月 火 水 木 金', 0.2, 0.9, 0.9, 0.7),
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
    ]);
    expect(result.candidates[0]).toMatchObject({
      day: '月',
      period: 1,
      subject: '数学',
    });
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
