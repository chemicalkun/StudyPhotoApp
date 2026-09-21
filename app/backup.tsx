import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Stack } from 'expo-router';

import { createBackupFile } from '@/services/backup-storage';


export default function BackupScreen() {
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');


  const exportBackup = async () => {
    if (exporting) {
      return;
    }

    try {
      setExporting(true);
      setErrorMessage('');
      setStatusMessage('');

      const fileUri = await createBackupFile();
      const result = await Share.share({
        title: 'StudyPhotoバックアップ',
        url: fileUri,
      });

      if (result.action === Share.sharedAction) {
        setStatusMessage(
          'バックアップファイルを書き出しました。'
        );
      }
    } catch (error) {
      console.log('バックアップ書き出しエラー:', error);
      setErrorMessage(
        'バックアップを書き出せませんでした。もう一度お試しください。'
      );
    } finally {
      setExporting(false);
    }
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'バックアップ',
          headerBackTitle: 'ホーム',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>バックアップ</Text>

        <Text style={styles.description}>
          StudyPhotoの設定と学習データを、1つのJSONファイルとして書き出します。
        </Text>

        <View style={styles.includedCard}>
          <Text style={styles.cardTitle}>保存されるデータ</Text>
          <Text style={styles.cardText}>
            時間割・時限設定・写真情報・文字認識結果・授業まとめ・試験対策・練習問題・フラッシュカード
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>現在の制限</Text>
          <Text style={styles.warningText}>
            写真画像そのものは、このバックアップファイルに含まれません。復元機能と写真を含む完全バックアップは今後追加します。
          </Text>
        </View>

        <Pressable
          style={[
            styles.exportButton,
            exporting && styles.exportButtonDisabled,
          ]}
          disabled={exporting}
          onPress={() => void exportBackup()}
        >
          {exporting ? (
            <ActivityIndicator color="white" />
          ) : null}
          <Text style={styles.exportButtonText}>
            {exporting
              ? 'バックアップを作成中...'
              : 'バックアップを書き出す'}
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          共有画面で「ファイルに保存」を選択してください。
        </Text>

        {statusMessage !== '' ? (
          <Text style={styles.successText}>
            {statusMessage}
          </Text>
        ) : null}

        {errorMessage !== '' ? (
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  scrollView: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 48 },
  title: { color: '#111', fontSize: 30, fontWeight: 'bold', marginTop: 24 },
  description: { color: '#555', fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 20 },
  includedCard: { backgroundColor: '#eef8f2', borderWidth: 1, borderColor: '#9bc9aa', borderRadius: 12, padding: 16 },
  cardTitle: { color: '#28794c', fontSize: 16, fontWeight: 'bold' },
  cardText: { color: '#333', fontSize: 14, lineHeight: 22, marginTop: 8 },
  warningCard: { backgroundColor: '#fff3d6', borderWidth: 1, borderColor: '#f0c96d', borderRadius: 12, padding: 16, marginTop: 14 },
  warningTitle: { color: '#725b24', fontSize: 16, fontWeight: 'bold' },
  warningText: { color: '#5e4b20', fontSize: 13, lineHeight: 21, marginTop: 8 },
  exportButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#31518f', borderRadius: 10, padding: 15, marginTop: 22 },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  hint: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 9 },
  successText: { color: '#28794c', fontSize: 13, textAlign: 'center', marginTop: 16 },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 16 },
});
