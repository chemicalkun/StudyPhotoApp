import { searchRecognizedPhotos } from '@/types/photo-search';


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
  });

  test('空の検索語と一致しない検索語では結果を返さない', () => {
    expect(
      searchRecognizedPhotos(photos, ocrRecords, '  ')
    ).toEqual([]);
    expect(
      searchRecognizedPhotos(photos, ocrRecords, '物理')
    ).toEqual([]);
  });
});
