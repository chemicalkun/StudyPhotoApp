import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deleteLectureSummaryRecord,
  loadLectureSummaryRecords,
  moveLectureSummaryRecord,
  moveLectureSummaryRecords,
  saveLectureSummaryRecord,
  updateLectureSummaryText,
} from '@/services/lecture-summary-storage';
import {
  createLectureSummaryId,
  createLectureSummarySourceSignature,
  getLectureSummarySourcePhotoIds,
  getLectureSummaryUpdateReason,
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

  test('元データ署名からまとめに使った写真IDを取得する', () => {
    const signature = createLectureSummarySourceSignature([
      {
        photoId: 'photo-1',
        recognizedAt: '2026-09-21T01:00:00.000Z',
      },
      {
        photoId: 'photo-2',
        recognizedAt: '2026-09-21T01:01:00.000Z',
      },
    ]);

    expect(
      getLectureSummarySourcePhotoIds(signature)
    ).toEqual(['photo-1', 'photo-2']);
    expect(
      getLectureSummarySourcePhotoIds('legacy-signature')
    ).toBeNull();
  });

  test('まとめの更新が必要になった理由を判定する', () => {
    const recognizedAt =
      '2026-09-21T01:00:00.000Z';
    const signature = createLectureSummarySourceSignature([
      { photoId: 'photo-1', recognizedAt },
      { photoId: 'photo-2', recognizedAt },
    ]);

    expect(
      getLectureSummaryUpdateReason(
        signature,
        ['photo-1', 'photo-2', 'photo-3'],
        [
          { photoId: 'photo-1', recognizedAt },
          { photoId: 'photo-2', recognizedAt },
        ]
      )
    ).toBe('photosChanged');
    expect(
      getLectureSummaryUpdateReason(
        signature,
        ['photo-2', 'photo-1'],
        [
          { photoId: 'photo-2', recognizedAt },
          { photoId: 'photo-1', recognizedAt },
        ]
      )
    ).toBe('photoOrderChanged');
    expect(
      getLectureSummaryUpdateReason(
        signature,
        ['photo-1', 'photo-2'],
        [{ photoId: 'photo-1', recognizedAt }]
      )
    ).toBe('ocrMissing');
    expect(
      getLectureSummaryUpdateReason(
        signature,
        ['photo-1', 'photo-2'],
        [
          {
            photoId: 'photo-1',
            recognizedAt: '2026-09-21T02:00:00.000Z',
            manuallyEdited: true,
          },
          { photoId: 'photo-2', recognizedAt },
        ]
      )
    ).toBe('ocrEdited');
    expect(
      getLectureSummaryUpdateReason(
        signature,
        ['photo-1', 'photo-2'],
        [
          {
            photoId: 'photo-1',
            recognizedAt: '2026-09-21T02:00:00.000Z',
          },
          { photoId: 'photo-2', recognizedAt },
        ]
      )
    ).toBe('ocrUpdated');
    expect(
      getLectureSummaryUpdateReason(
        signature,
        ['photo-1', 'photo-2'],
        [
          { photoId: 'photo-1', recognizedAt },
          { photoId: 'photo-2', recognizedAt },
        ]
      )
    ).toBeNull();
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

  test('授業まとめを同じ日の別授業へ移動する', async () => {
    const saved = await saveLectureSummaryRecord(
      '未分類',
      '2026-9-21',
      '授業まとめ',
      'source-1'
    );

    const moved = await moveLectureSummaryRecord(
      saved.id,
      '高分子化学'
    );
    const records = await loadLectureSummaryRecords();

    expect(records[saved.id]).toBeUndefined();
    expect(records[moved.id]).toMatchObject({
      subject: '高分子化学',
      dateKey: '2026-9-21',
      text: '授業まとめ',
    });
  });

  test('移動先に同じ日のまとめがある場合は上書きしない', async () => {
    const saved = await saveLectureSummaryRecord(
      '未分類',
      '2026-9-21',
      '未分類のまとめ',
      'source-1'
    );
    await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-21',
      '既存のまとめ',
      'source-2'
    );

    await expect(
      moveLectureSummaryRecord(
        saved.id,
        '高分子化学'
      )
    ).rejects.toThrow(
      '移動先に同じ日の授業まとめがあります'
    );

    const records = await loadLectureSummaryRecords();

    expect(records[saved.id]?.text).toBe(
      '未分類のまとめ'
    );
  });

  test('複数回の授業まとめを一括移動する', async () => {
    const first = await saveLectureSummaryRecord(
      '未分類',
      '2026-9-21',
      '第1回のまとめ',
      'source-1'
    );
    const second = await saveLectureSummaryRecord(
      '未分類',
      '2026-9-28',
      '第2回のまとめ',
      'source-2'
    );

    const moved = await moveLectureSummaryRecords(
      [first.id, second.id],
      '高分子化学'
    );
    const records = await loadLectureSummaryRecords();

    expect(moved).toHaveLength(2);
    expect(records[first.id]).toBeUndefined();
    expect(records[second.id]).toBeUndefined();
    expect(
      records[
        createLectureSummaryId(
          '高分子化学',
          '2026-9-21'
        )
      ]?.text
    ).toBe('第1回のまとめ');
    expect(
      records[
        createLectureSummaryId(
          '高分子化学',
          '2026-9-28'
        )
      ]?.text
    ).toBe('第2回のまとめ');
  });

  test('一括移動で衝突する場合はどのまとめも移動しない', async () => {
    const first = await saveLectureSummaryRecord(
      '未分類',
      '2026-9-21',
      '第1回のまとめ',
      'source-1'
    );
    const second = await saveLectureSummaryRecord(
      '未分類',
      '2026-9-28',
      '第2回のまとめ',
      'source-2'
    );
    await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-28',
      '既存のまとめ',
      'source-3'
    );

    await expect(
      moveLectureSummaryRecords(
        [first.id, second.id],
        '高分子化学'
      )
    ).rejects.toThrow(
      '移動先に同じ日の授業まとめがあります'
    );

    const records = await loadLectureSummaryRecords();

    expect(records[first.id]?.text).toBe(
      '第1回のまとめ'
    );
    expect(records[second.id]?.text).toBe(
      '第2回のまとめ'
    );
  });

  test('指定した授業まとめだけを削除する', async () => {
    const first = await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-21',
      '第1回のまとめ',
      'source-1'
    );
    const second = await saveLectureSummaryRecord(
      '高分子化学',
      '2026-9-28',
      '第2回のまとめ',
      'source-2'
    );

    await deleteLectureSummaryRecord(first.id);

    const records = await loadLectureSummaryRecords();

    expect(records[first.id]).toBeUndefined();
    expect(records[second.id]).toBeDefined();
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
