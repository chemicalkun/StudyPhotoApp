import {
  matchesStudySearchText,
  normalizeStudySearchText,
  searchRecognizedPhotos,
} from '@/types/photo-search';


describe('recognized photo search', () => {
  const photos = [
    {
      id: 'photo-old',
      uri: 'file:///old.jpg',
      takenAt: '2026-09-20T01:00:00.000Z',
      day: '月',
      period: 2,
      subject: '高分子化学',
    },
    {
      id: 'photo-new',
      uri: 'file:///new.jpg',
      takenAt: '2026-09-21T01:00:00.000Z',
      day: '火',
      period: 1,
      subject: '有機化学',
    },
  ];
  const ocrRecords = {
    'photo-old': {
      photoId: 'photo-old',
      text: '重合反応について学習する',
      blocks: [],
      recognizedAt: '2026-09-20T02:00:00.000Z',
    },
    'photo-new': {
      photoId: 'photo-new',
      text: '付加重合と縮合重合を比較する',
      blocks: [],
      recognizedAt: '2026-09-21T02:00:00.000Z',
    },
  };

  test('OCR文字に一致する写真を新しい順で返す', () => {
    const results = searchRecognizedPhotos(
      photos,
      ocrRecords,
      '重合'
    );

    expect(results.map((result) => result.photo.id)).toEqual([
      'photo-new',
      'photo-old',
    ]);
    expect(results[0].preview).toContain('付加重合');
    expect(results[0].source).toBe('ocr');
  });

  test('空の検索語と一致しない検索語では結果を返さない', () => {
    expect(
      searchRecognizedPhotos(photos, ocrRecords, '  ')
    ).toEqual([]);
    expect(
      searchRecognizedPhotos(photos, ocrRecords, '物理')
    ).toEqual([]);
  });

  test('OCRの不要な空白と全角半角の違いを吸収する', () => {
    const spacedOcrRecords = {
      ...ocrRecords,
      'photo-new': {
        ...ocrRecords['photo-new'],
        text: '有機化学 演 \n習 ２',
      },
    };

    const results = searchRecognizedPhotos(
      photos,
      spacedOcrRecords,
      '演習2'
    );

    expect(results.map((result) => result.photo.id)).toEqual([
      'photo-new',
    ]);
    expect(results[0].preview).toContain('演 習 ２');
    expect(normalizeStudySearchText(' Ａ Ｂ c ')).toBe(
      'abc'
    );
  });

  test('離れた位置にある複数の検索語すべてに一致する', () => {
    const results = searchRecognizedPhotos(
      photos,
      ocrRecords,
      '付加 比較'
    );

    expect(results.map((result) => result.photo.id)).toEqual([
      'photo-new',
    ]);
    expect(
      matchesStudySearchText(
        '有機化学\n付加重合の反応を学ぶ',
        '有機 反応'
      )
    ).toBe(true);
    expect(
      matchesStudySearchText(
        '有機化学\n付加重合の反応を学ぶ',
        '有機 物理'
      )
    ).toBe(false);
  });

  test('写真メモだけに含まれる文字でも検索できる', () => {
    const photosWithNote = photos.map((photo) =>
      photo.id === 'photo-old'
        ? {
            ...photo,
            note: '試験前に反応機構を復習する',
          }
        : photo
    );
    const results = searchRecognizedPhotos(
      photosWithNote,
      ocrRecords,
      '試験前'
    );

    expect(results).toHaveLength(1);
    expect(results[0].photo.id).toBe('photo-old');
    expect(results[0].preview).toContain('反応機構');
    expect(results[0].source).toBe('note');
  });

  test('メモとOCRに分かれた複数語でも検索できる', () => {
    const photosWithNote = photos.map((photo) =>
      photo.id === 'photo-new'
        ? { ...photo, note: '試験前に確認' }
        : photo
    );
    const results = searchRecognizedPhotos(
      photosWithNote,
      ocrRecords,
      '試験 縮合'
    );

    expect(results).toHaveLength(1);
    expect(results[0].photo.id).toBe('photo-new');
    expect(results[0].source).toBe('noteAndOcr');
  });
});
