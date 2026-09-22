import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hasSeenGettingStartedGuide,
  markGettingStartedGuideAsSeen,
} from '@/services/getting-started-storage';


describe('getting started storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('ガイドを表示するまでは未確認として扱う', async () => {
    await expect(
      hasSeenGettingStartedGuide()
    ).resolves.toBe(false);
  });

  test('表示済み状態を保存する', async () => {
    await markGettingStartedGuideAsSeen();

    await expect(
      hasSeenGettingStartedGuide()
    ).resolves.toBe(true);
  });
});
