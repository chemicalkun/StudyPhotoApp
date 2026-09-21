import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadExamPreparationRecords,
  saveExamPreparationRecord,
} from '@/services/exam-preparation-storage';
import {
  createExamPreparationRecordId,
  createExamPreparationSourceSignature,
  parseExamPreparationRecords,
} from '@/types/exam-preparation';


describe('exam preparation storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('科目ごとに試験対策を保存する', async () => {
    const record = await saveExamPreparationRecord(
      '有機化学',
      ' 重要テーマと確認問題 ',
      'summary-signature-1'
    );

    const records = await loadExamPreparationRecords();

    expect(records[record.id]).toMatchObject({
      subject: '有機化学',
      text: '重要テーマと確認問題',
      sourceSummarySignature: 'summary-signature-1',
    });
    expect(record.id).toBe(
      createExamPreparationRecordId('有機化学')
    );
  });

  test('授業回まとめが更新されると署名も変わる', () => {
    const firstSignature =
      createExamPreparationSourceSignature([
        {
          id: 'summary-1',
          createdAt: '2026-09-21T01:00:00.000Z',
        },
      ]);
    const updatedSignature =
      createExamPreparationSourceSignature([
        {
          id: 'summary-1',
          createdAt: '2026-09-21T02:00:00.000Z',
        },
      ]);

    expect(updatedSignature).not.toBe(firstSignature);
  });

  test('別科目の試験対策を上書きしない', async () => {
    await saveExamPreparationRecord(
      '有機化学',
      '有機化学の試験対策',
      'signature-1'
    );
    await saveExamPreparationRecord(
      '無機化学',
      '無機化学の試験対策',
      'signature-2'
    );

    const records = await loadExamPreparationRecords();

    expect(Object.keys(records)).toHaveLength(2);
  });
});


describe('parseExamPreparationRecords', () => {
  test('不正な保存データを拒否する', () => {
    expect(() =>
      parseExamPreparationRecords(
        '{"exam-1":{"text":123}}'
      )
    ).toThrow('examPreparationRecordsの形式が不正です');
  });
});
