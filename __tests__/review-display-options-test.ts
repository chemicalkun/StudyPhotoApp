import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultReviewDisplayOptions,
  loadReviewDisplayOptions,
  parseReviewDisplayOptions,
  saveReviewDisplayOptions,
} from '@/utils/review-display-options';


describe('review display options', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('初期状態はすべての欄を表示する', async () => {
    await expect(loadReviewDisplayOptions()).resolves.toEqual(
      defaultReviewDisplayOptions
    );
  });

  test('各欄の表示設定を個別に保存できる', async () => {
    const options = {
      showReviewQueue: false,
      showSubjectProgress: true,
      showImportantPhotos: false,
      showPhotoNotes: true,
      subjectProgressSortMode: 'subject' as const,
      subjectProgressFilterMode: 'all' as const,
    };

    await saveReviewDisplayOptions(options);

    await expect(loadReviewDisplayOptions()).resolves.toEqual(
      options
    );
  });

  test('不正な設定は読み込まない', () => {
    expect(() =>
      parseReviewDisplayOptions(
        JSON.stringify({ showReviewQueue: true })
      )
    ).toThrow('復習タブ表示設定の形式が不正です');

    expect(() =>
      parseReviewDisplayOptions(JSON.stringify({
        ...defaultReviewDisplayOptions,
        subjectProgressSortMode: 'invalid',
      }))
    ).toThrow('復習タブ表示設定の形式が不正です');

    expect(() =>
      parseReviewDisplayOptions(JSON.stringify({
        ...defaultReviewDisplayOptions,
        subjectProgressFilterMode: 'invalid',
      }))
    ).toThrow('復習タブ表示設定の形式が不正です');
  });

  test('以前の設定には要対応順を補う', () => {
    expect(parseReviewDisplayOptions(JSON.stringify({
      showReviewQueue: true,
      showSubjectProgress: true,
      showImportantPhotos: true,
      showPhotoNotes: true,
      subjectProgressSortMode: 'attention',
    }))).toEqual(defaultReviewDisplayOptions);
  });
});
