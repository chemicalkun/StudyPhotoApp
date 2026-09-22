import AsyncStorage from '@react-native-async-storage/async-storage';


const gettingStartedSeenStorageKey =
  'gettingStartedGuideSeenV1';


export const hasSeenGettingStartedGuide = async () =>
  await AsyncStorage.getItem(
    gettingStartedSeenStorageKey
  ) === 'true';


export const markGettingStartedGuideAsSeen = async () => {
  await AsyncStorage.setItem(
    gettingStartedSeenStorageKey,
    'true'
  );
};
