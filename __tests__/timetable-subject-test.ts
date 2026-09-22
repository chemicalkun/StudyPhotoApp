import { renameTimetableSubject } from '@/utils/timetable-subject';


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
});
