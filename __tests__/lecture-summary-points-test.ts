import {
  extractLectureSummaryReviewPoints,
} from '@/utils/lecture-summary-points';


describe('extractLectureSummaryReviewPoints', () => {
  it('復習ポイントの箇条書きを取得する', () => {
    const summary = `
【この回のテーマ】
化学平衡を学ぶ。

【復習ポイント】
- 平衡定数の定義
・ルシャトリエの原理
3. 濃度と平衡移動の関係

【補足】
この行は含めない。
`;

    expect(
      extractLectureSummaryReviewPoints(summary)
    ).toEqual([
      '平衡定数の定義',
      'ルシャトリエの原理',
      '濃度と平衡移動の関係',
    ]);
  });

  it('重複を除き、指定数まで返す', () => {
    const summary = `
【重要語句】
• 共有結合
• 共有結合
• イオン結合
`;

    expect(
      extractLectureSummaryReviewPoints(summary, 1)
    ).toEqual(['共有結合']);
  });

  it('Markdown付きの見出しと表記揺れに対応する', () => {
    const summary = `
### **【復習のポイント】**
* 共役酸と共役塩基
* 酸解離定数
`;

    expect(
      extractLectureSummaryReviewPoints(summary)
    ).toEqual([
      '共役酸と共役塩基',
      '酸解離定数',
    ]);
  });

  it('復習ポイントがなければ要点を表示する', () => {
    expect(
      extractLectureSummaryReviewPoints('【要点】\n- 重要な内容')
    ).toEqual(['重要な内容']);
  });

  it('同じ行に書かれた項目も取得する', () => {
    expect(
      extractLectureSummaryReviewPoints(
        '【重要語句】：アボガドロ定数'
      )
    ).toEqual(['アボガドロ定数']);
  });
});
