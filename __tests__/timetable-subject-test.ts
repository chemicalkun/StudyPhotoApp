import {
  getTimetableSubjectRenames,
  getTimetableSubjectSlots,
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

  test('授業の時間割位置を曜日・時限順で取得する', () => {
    expect(getTimetableSubjectSlots(
      {
        '木-3': '化学',
        '月-2': 'Ｃｈｅｍ',
        '火-1': '英語',
        'invalid': 'Chem',
      },
      'Chem'
    )).toEqual([
      { day: '月', period: 2 },
    ]);

    expect(getTimetableSubjectSlots(
      {
        '木-3': '化学',
        '月-2': '化学',
      },
      '化学'
    )).toEqual([
      { day: '月', period: 2 },
      { day: '木', period: 3 },
    ]);
  });

  test('すべての時間割枠が同じ新授業名へ変わったら名称変更と判定する', () => {
    expect(getTimetableSubjectRenames(
      {
        '月-1': '化学',
        '木-2': '化学',
      },
      {
        '月-1': '高分子化学',
        '木-2': '高分子化学',
      }
    )).toEqual([{
      previousSubject: '化学',
      nextSubject: '高分子化学',
    }]);
  });

  test('旧授業名が残る場合は名称変更と判定しない', () => {
    expect(getTimetableSubjectRenames(
      {
        '月-1': '化学',
        '木-2': '化学',
      },
      {
        '月-1': '高分子化学',
        '木-2': '化学',
      }
    )).toEqual([]);
  });

  test('複数の新授業名へ分かれる場合は名称変更と判定しない', () => {
    expect(getTimetableSubjectRenames(
      {
        '月-1': '化学',
        '木-2': '化学',
      },
      {
        '月-1': '有機化学',
        '木-2': '無機化学',
      }
    )).toEqual([]);
  });
});
