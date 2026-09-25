import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultTimetableDisplayOptions,
  getEnabledPeriodNumbers,
  getEnabledTimetableDays,
  loadTimetableDisplayOptions,
  saveTimetableDisplayOptions,
} from '@/utils/timetable-display-options';


describe('timetable display options', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('初期状態は土曜日と6限を表示しない', async () => {
    await expect(
      loadTimetableDisplayOptions()
    ).resolves.toEqual(defaultTimetableDisplayOptions);
    expect(
      getEnabledTimetableDays(defaultTimetableDisplayOptions)
    ).toEqual(['月', '火', '水', '木', '金']);
    expect(
      getEnabledPeriodNumbers(defaultTimetableDisplayOptions)
    ).toEqual([1, 2, 3, 4, 5]);
  });

  test('土曜日と6限を有効にできる', async () => {
    const options = {
      showSaturday: true,
      showSixthPeriod: true,
    };

    await saveTimetableDisplayOptions(options);

    await expect(
      loadTimetableDisplayOptions()
    ).resolves.toEqual(options);
    expect(getEnabledTimetableDays(options)).toContain('土');
    expect(getEnabledPeriodNumbers(options)).toContain(6);
  });
});
