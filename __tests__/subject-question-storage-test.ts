import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deleteSubjectQuestionRecord,
  loadSubjectQuestionRecords,
  saveSubjectQuestionRecord,
  updateSubjectQuestionRecord,
} from '@/services/subject-question-storage';
import {
  createSubjectQuestionSourceSignature,
} from '@/types/subject-question';


describe('subject question storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('授業全体への質問と回答を保存する', async () => {
    const signature = createSubjectQuestionSourceSignature([
      {
        id: '["高分子化学","2026-09-21"]',
        createdAt: '2026-09-21T10:00:00.000Z',
      },
    ]);
    const saved = await saveSubjectQuestionRecord(
      '高分子化学',
      ' 重要な内容は？ ',
      ' 重合反応です。 ',
      signature
    );
    const records = await loadSubjectQuestionRecords();

    expect(records[saved.id]).toMatchObject({
      subject: '高分子化学',
      question: '重要な内容は？',
      answer: '重合反応です。',
      sourceSummarySignature: signature,
    });
  });

  test('指定した質問履歴だけを削除する', async () => {
    const first = await saveSubjectQuestionRecord(
      '高分子化学',
      '質問1',
      '回答1',
      'signature'
    );
    const second = await saveSubjectQuestionRecord(
      '高分子化学',
      '質問2',
      '回答2',
      'signature'
    );

    await deleteSubjectQuestionRecord(first.id);

    const records = await loadSubjectQuestionRecords();

    expect(records[first.id]).toBeUndefined();
    expect(records[second.id]).toEqual(second);
  });

  test('質問と回答を編集して作成時の情報を維持する', async () => {
    const saved = await saveSubjectQuestionRecord(
      '高分子化学',
      '質問',
      '回答',
      'signature'
    );

    const updated = await updateSubjectQuestionRecord(
      saved.id,
      ' 修正後の質問 ',
      ' 修正後の回答 '
    );

    expect(updated).toMatchObject({
      id: saved.id,
      subject: saved.subject,
      question: '修正後の質問',
      answer: '修正後の回答',
      sourceSummarySignature: saved.sourceSummarySignature,
      createdAt: saved.createdAt,
    });
  });
});
