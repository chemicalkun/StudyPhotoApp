import {
  getUniqueTimetableSubjects,
  renameTimetableSubject,
} from '@/utils/timetable-subject';


describe('timetable subject', () => {
  test('同じ授業名の時間割枠をすべて変更する', () => {
    const renamed = renameTimetableSubject(
      {
        '月-2': '化学',
        '木-3': '化学',
        '金-1': '英語',
      },
      '化学',
      '高分子化学'
    );

    expect(renamed).toEqual({
      '月-2': '高分子化学',
      '木-3': '高分子化学',
      '金-1': '英語',
    });
  });

  test('全角と半角が違っても同じ授業名として扱う', () => {
    const renamed = renameTimetableSubject(
      { '月-2': 'Ｃｈｅｍ' },
      'Chem',
      '化学'
    );

    expect(renamed['月-2']).toBe('化学');
  });

  test('時間割から重複と空欄を除いた授業名を取得する', () => {
    expect(getUniqueTimetableSubjects({
      '月-1': '化学',
      '火-2': ' 化学 ',
      '水-3': '英語',
      '木-4': '',
    })).toEqual(['英語', '化学']);
  });
});
