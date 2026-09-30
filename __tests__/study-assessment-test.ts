import { getUnansweredItemIndexes } from '@/utils/study-assessment';


describe('study assessment', () => {
  test('自己評価がまだない項目の番号だけ返す', () => {
    expect(getUnansweredItemIndexes(5, {
      '0': 'known',
      '2': 'review',
      '4': 'known',
    })).toEqual([1, 3]);
  });

  test('項目がない場合は空配列を返す', () => {
    expect(getUnansweredItemIndexes(0, {})).toEqual([]);
  });
});
