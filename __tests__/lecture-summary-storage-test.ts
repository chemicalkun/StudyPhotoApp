import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadLectureSummaryRecords,
  saveLectureSummaryRecord,
  updateLectureSummaryText,
} from '@/services/lecture-summary-storage';
import {
  createLectureSummaryId,
  createLectureSummarySourceSignature,
  parseLectureSummaryRecords,
} from '@/types/lecture-summary';


describe('lecture summary storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('授業と撮影日ごとにまとめを保存する', async () => {
    const record = await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-21',
      ' 高分子の分子量について学習した。 ',
      'source-1'
    );

    const records = await loadLectureSummaryRecords();

    expect(records[record.id]).toMatchObject({
      subject: '高分子化学',
      dateKey: '2026-9-21',
      text: '高分子の分子量について学習した。',
      sourceOcrSignature: 'source-1',
    });
  });

  test('別の授業回のまとめを上書きしない', async () => {
    await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-21',
      '第1回のまとめ',
      'source-1'
    );
    await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-28',
      '第2回のまとめ',
      'source-2'
    );

    const records = await loadLectureSummaryRecords();

    expect(Object.keys(records)).toHaveLength(2);
    expect(
      records[
        createLectureSummaryId(
          '高分子化学',
          '2026-9-28'
        )
      ].text
    ).toBe('第2回のまとめ');
  });

  test('OCR日時が変わると元データ署名も変わる', () => {
    const firstSignature =
      createLectureSummarySourceSignature([
        {
          photoId: 'photo-1',
          recognizedAt: '2026-09-21T01:00:00.000Z',
        },
      ]);
    const updatedSignature =
      createLectureSummarySourceSignature([
        {
          photoId: 'photo-1',
          recognizedAt: '2026-09-21T02:00:00.000Z',
        },
      ]);

    expect(updatedSignature).not.toBe(firstSignature);
  });

  test('保存済みのまとめ本文を編集する', async () => {
    const saved = await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-21',
      '編集前のまとめ',
      'source-1'
    );

    const updated = await updateLectureSummaryText(
      saved.id,
      ' 編集後のまとめ '
    );
    const records = await loadLectureSummaryRecords();

    expect(updated.text).toBe('編集後のまとめ');
    expect(updated.sourceOcrSignature).toBe('source-1');
    expect(records[saved.id]).toEqual(updated);
  });
});


describe('parseLectureSummaryRecords', () => {
  test('不正な保存データを拒否する', () => {
    expect(() =>
      parseLectureSummaryRecords(
        '{"summary-1":{"text":123}}'
      )
    ).toThrow('lectureSummaryRecordsの形式が不正です');
  });
});
