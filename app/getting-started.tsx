import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  Stack,
  useLocalSearchParams,
} from 'expo-router';

import { markGettingStartedGuideAsSeen } from '@/services/getting-started-storage';


const guideSteps = [
  {
    number: 1,
    title: '時間割を登録',
    description:
      '授業名を入力するか、時間割画像を読み込んで登録します。時限の開始・終了時刻も大学に合わせて変更できます。',
  },
  {
    number: 2,
    title: '授業写真を追加',
    description:
      'アプリで撮影するか、写真ライブラリから選択します。撮影日時と時間割から授業を判定します。',
  },
  {
    number: 3,
    title: '授業・授業回ごとに確認',
    description:
      '写真は授業別に整理され、同じ授業日に撮影した写真は1回分としてまとまります。',
  },
  {
    number: 4,
    title: '文字認識とまとめを作成',
    description:
      '写真内の文字を認識し、授業回のまとめを作成します。復習タブから試験対策・練習問題・カードも利用できます。',
  },
] as const;


export default function GettingStartedScreen() {
  const params = useLocalSearchParams();
  const openedForOnboarding =
    params.from === 'onboarding';


  useEffect(() => {
    const markAsSeen = async () => {
      try {
        await markGettingStartedGuideAsSeen();
      } catch (error) {
        console.log('初回ガイド保存エラー:', error);
      }
    };

    void markAsSeen();
  }, []);


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '使い方',
          headerBackTitle: openedForOnboarding
            ? 'ホーム'
            : '設定',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>
          StudyPhotoの使い方
        </Text>

        <Text style={styles.description}>
          最初に時間割を登録すると、授業写真を自動で整理しやすくなります。
        </Text>

        <View style={styles.stepList}>
          {guideSteps.map((step) => (
            <View key={step.number} style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>
                  {step.number}
                </Text>
              </View>

              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>
                  {step.title}
                </Text>
                <Text style={styles.stepDescription}>
                  {step.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            AI学習機能について
          </Text>
          <Text style={styles.noticeText}>
            写真の文字認識にはStudyPhotoの開発ビルドが必要です。まとめ・試験対策などの端末内AI機能には、対応するiPhone、iOSとApple Intelligenceも必要です。
          </Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          accessibilityRole="button"
          onPress={() => router.push({
            pathname: '/timetable',
            params: { from: 'getting-started' },
          })}
        >
          <Text style={styles.primaryButtonText}>
            時間割を設定する
          </Text>
        </Pressable>

        <Pressable
          style={styles.closeButton}
          accessibilityRole="button"
          onPress={() => router.back()}
        >
          <Text style={styles.closeButtonText}>
            {openedForOnboarding
              ? 'ホームへ進む'
              : '設定に戻る'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    color: '#111',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 24,
  },

  description: {
    color: '#555',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 9,
  },

  stepList: {
    gap: 12,
    marginTop: 24,
  },

  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#d9dde5',
    borderRadius: 12,
    padding: 16,
  },

  stepNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#31518f',
    borderRadius: 16,
    marginRight: 13,
  },

  stepNumberText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },

  stepText: {
    flex: 1,
  },

  stepTitle: {
    color: '#222',
    fontSize: 17,
    fontWeight: 'bold',
  },

  stepDescription: {
    color: '#555',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },

  noticeCard: {
    backgroundColor: '#fff3d6',
    borderWidth: 1,
    borderColor: '#f0c96d',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },

  noticeTitle: {
    color: '#725b24',
    fontSize: 15,
    fontWeight: 'bold',
  },

  noticeText: {
    color: '#5e4b20',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#31518f',
    borderRadius: 10,
    padding: 15,
    marginTop: 24,
  },

  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  closeButton: {
    alignItems: 'center',
    padding: 14,
    marginTop: 6,
  },

  closeButtonText: {
    color: '#555',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
