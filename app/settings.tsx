import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Constants from 'expo-constants';
import {
  router,
  Stack,
  useFocusEffect,
} from 'expo-router';

import { loadAcademicTerm } from '@/services/academic-term-storage';
import { formatAcademicTerm } from '@/types/academic-term';
import { parseLectureSummaryRecords } from '@/types/lecture-summary';
import { parsePhotoRecords } from '@/types/photo';
import { parseTimetable } from '@/utils/classification';
import { loadPeriodTimes } from '@/utils/period-times';
import { loadTimetableDisplayOptions } from '@/utils/timetable-display-options';


type SettingsLinkProps = {
  title: string;
  description: string;
  onPress: () => void;
};


function SettingsLink({
  title,
  description,
  onPress,
}: SettingsLinkProps) {
  return (
    <Pressable
      style={styles.settingsLink}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
    >
      <View style={styles.settingsLinkText}>
        <Text style={styles.settingsLinkTitle}>
          {title}
        </Text>
        <Text style={styles.settingsLinkDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}


export default function SettingsScreen() {
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [academicTermDescription, setAcademicTermDescription] =
    useState('現在の学年・学期を読み込み中...');
  const [displayOptionsDescription, setDisplayOptionsDescription] =
    useState('現在の表示範囲を読み込み中...');
  const [periodTimesDescription, setPeriodTimesDescription] =
    useState('現在の時限設定を読み込み中...');
  const [timetableDescription, setTimetableDescription] =
    useState('現在の時間割を読み込み中...');
  const [backupDescription, setBackupDescription] =
    useState('現在の学習データを読み込み中...');


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshAcademicTerm = async () => {
        try {
          const academicTerm = await loadAcademicTerm();

          if (active) {
            setAcademicTermDescription(
              `現在：${formatAcademicTerm(academicTerm)}`
            );
          }
        } catch (error) {
          console.log(
            '設定画面の学年・学期読み込みエラー:',
            error
          );

          if (active) {
            setAcademicTermDescription(
              '現在の学年・学期を確認できません'
            );
          }
        }
      };

      void refreshAcademicTerm();

      return () => {
        active = false;
      };
    }, [])
  );


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshBackupOverview = async () => {
        try {
          const entries = await AsyncStorage.multiGet([
            'photos',
            'lectureSummaryRecords',
          ]);
          const savedValues = Object.fromEntries(entries);
          const photoCount = savedValues.photos === null
            ? 0
            : parsePhotoRecords(savedValues.photos).length;
          const summaryCount =
            savedValues.lectureSummaryRecords === null
              ? 0
              : Object.keys(
                  parseLectureSummaryRecords(
                    savedValues.lectureSummaryRecords
                  )
                ).length;

          if (active) {
            setBackupDescription(
              `現在の学期：写真${photoCount}枚・授業まとめ${summaryCount}件`
            );
          }
        } catch (error) {
          console.log(
            '設定画面のバックアップ対象読み込みエラー:',
            error
          );

          if (active) {
            setBackupDescription(
              '現在の学習データを確認できません'
            );
          }
        }
      };

      void refreshBackupOverview();

      return () => {
        active = false;
      };
    }, [])
  );


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshTimetable = async () => {
        try {
          const savedTimetable =
            await AsyncStorage.getItem('timetable');
          const timetable =
            parseTimetable(savedTimetable) ?? {};
          const registeredClassCount = Object.values(
            timetable
          ).filter((subject) => subject.trim() !== '').length;

          if (active) {
            setTimetableDescription(
              registeredClassCount > 0
                ? `${registeredClassCount}コマ登録済み・授業名の登録・変更`
                : '授業はまだ登録されていません'
            );
          }
        } catch (error) {
          console.log(
            '設定画面の時間割読み込みエラー:',
            error
          );

          if (active) {
            setTimetableDescription(
              '現在の時間割を確認できません'
            );
          }
        }
      };

      void refreshTimetable();

      return () => {
        active = false;
      };
    }, [])
  );


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshPeriodTimes = async () => {
        try {
          const periodTimes = await loadPeriodTimes();

          if (active) {
            setPeriodTimesDescription(
              `1限：${periodTimes[1].start}〜${periodTimes[1].end}・各時限の時刻を変更`
            );
          }
        } catch (error) {
          console.log(
            '設定画面の時限設定読み込みエラー:',
            error
          );

          if (active) {
            setPeriodTimesDescription(
              '現在の時限設定を確認できません'
            );
          }
        }
      };

      void refreshPeriodTimes();

      return () => {
        active = false;
      };
    }, [])
  );


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshDisplayOptions = async () => {
        try {
          const displayOptions =
            await loadTimetableDisplayOptions();

          if (active) {
            setDisplayOptionsDescription([
              displayOptions.showSaturday
                ? '土曜日：表示'
                : '土曜日：非表示',
              displayOptions.showSixthPeriod
                ? '6限：表示'
                : '6限：非表示',
            ].join('・'));
          }
        } catch (error) {
          console.log(
            '設定画面の表示範囲読み込みエラー:',
            error
          );

          if (active) {
            setDisplayOptionsDescription(
              '現在の表示範囲を確認できません'
            );
          }
        }
      };

      void refreshDisplayOptions();

      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '設定',
          headerBackTitle: 'ホーム',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>設定</Text>

        <Text style={styles.sectionTitle}>はじめに</Text>
        <View style={styles.sectionCard}>
          <SettingsLink
            title="StudyPhotoの使い方"
            description="時間割登録から復習までの流れを確認"
            onPress={() => router.push('/getting-started')}
          />
        </View>

        <Text style={styles.sectionTitle}>授業設定</Text>
        <View style={styles.sectionCard}>
          <SettingsLink
            title="学年・学期"
            description={academicTermDescription}
            onPress={() => router.push({
              pathname: '/academic-term',
              params: { from: 'settings' },
            })}
          />
          <View style={styles.divider} />
          <SettingsLink
            title="時間割"
            description={timetableDescription}
            onPress={() => router.push({
              pathname: '/timetable',
              params: { from: 'settings' },
            })}
          />
          <View style={styles.divider} />
          <SettingsLink
            title="表示する曜日・時限"
            description={displayOptionsDescription}
            onPress={() => router.push('/timetable-display-settings')}
          />
          <View style={styles.divider} />
          <SettingsLink
            title="時限設定"
            description={periodTimesDescription}
            onPress={() => router.push({
              pathname: '/period-settings',
              params: { from: 'settings' },
            })}
          />
        </View>

        <Text style={styles.sectionTitle}>データ管理</Text>
        <View style={styles.sectionCard}>
          <SettingsLink
            title="バックアップ"
            description={backupDescription}
            onPress={() => router.push({
              pathname: '/backup',
              params: { from: 'settings' },
            })}
          />
        </View>

        <Text style={styles.sectionTitle}>アプリ情報</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>{appVersion}</Text>
          </View>
          <Text style={styles.storageNotice}>
            写真情報・時間割・学習データは、基本的にこの端末内へ保存されます。
          </Text>
        </View>
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
    marginBottom: 26,
  },

  sectionTitle: {
    color: '#444',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 9,
  },

  sectionCard: {
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#d9dde5',
    borderRadius: 12,
    overflow: 'hidden',
  },

  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  settingsLinkText: {
    flex: 1,
  },

  settingsLinkTitle: {
    color: '#222',
    fontSize: 17,
    fontWeight: 'bold',
  },

  settingsLinkDescription: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  arrow: {
    color: '#777',
    fontSize: 28,
    marginLeft: 12,
  },

  divider: {
    height: 1,
    backgroundColor: '#d9dde5',
    marginLeft: 16,
  },

  infoCard: {
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#d9dde5',
    borderRadius: 12,
    padding: 16,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  infoLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },

  infoValue: {
    color: '#555',
    fontSize: 14,
  },

  storageNotice: {
    color: '#666',
    fontSize: 12,
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: '#d9dde5',
    paddingTop: 12,
    marginTop: 12,
  },
});
