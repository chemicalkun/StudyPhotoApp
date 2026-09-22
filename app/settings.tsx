import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';


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
            title="時間割"
            description="授業名の登録・変更と画像からの読み込み"
            onPress={() => router.push({
              pathname: '/timetable',
              params: { from: 'settings' },
            })}
          />
          <View style={styles.divider} />
          <SettingsLink
            title="時限設定"
            description="各時限の開始・終了時刻を変更"
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
            description="設定と学習データの書き出し・復元"
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
