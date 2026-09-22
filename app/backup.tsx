import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  createBackupFile,
  restoreBackup,
} from '@/services/backup-storage';
import { parseStudyPhotoBackup } from '@/types/backup';


export default function BackupScreen() {
  const params = useLocalSearchParams();
  const openedFromSettings = params.from === 'settings';
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
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


  const restoreSelectedBackup = async (
    savedBackup: string
  ) => {
    try {
      setRestoring(true);
      setErrorMessage('');
      setStatusMessage('');

      await restoreBackup(savedBackup);
      setStatusMessage(
        '設定と学習データを復元しました。現在の写真は変更していません。'
      );
    } catch (error) {
      console.log('バックアップ復元エラー:', error);
      setErrorMessage(
        'バックアップを復元できませんでした。ファイルが壊れている可能性があります。'
      );
    } finally {
      setRestoring(false);
    }
  };


  const selectBackupFile = async () => {
    if (restoring) {
      return;
    }

    try {
      setErrorMessage('');
      setStatusMessage('');

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const selectedFile = new File(result.assets[0].uri);
      const savedBackup = await selectedFile.text();
      const backup = parseStudyPhotoBackup(savedBackup);
      const exportedAt = new Date(
        backup.exportedAt
      ).toLocaleString('ja-JP');

      Alert.alert(
        'バックアップを復元しますか？',
        `${exportedAt}に作成されたバックアップです。現在の時間割と学習データは上書きされます。写真画像と写真情報は変更しません。`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '復元する',
            style: 'destructive',
            onPress: () => {
              void restoreSelectedBackup(savedBackup);
            },
          },
        ]
      );
    } catch (error) {
      console.log('バックアップファイル選択エラー:', error);
      setErrorMessage(
        'StudyPhotoのバックアップファイルを読み込めませんでした。'
      );
    }
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'バックアップ',
          headerBackTitle: openedFromSettings
            ? '設定'
            : 'ホーム',
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
            時間割・時限設定・写真情報・文字認識結果・授業まとめ・試験対策・練習問題・フラッシュカード・質問履歴
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>現在の制限</Text>
          <Text style={styles.warningText}>
            写真画像そのものは、このバックアップファイルに含まれません。復元しても現在の写真は変更されません。
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

        <View style={styles.divider} />

        <Text style={styles.restoreTitle}>
          バックアップから復元
        </Text>

        <Text style={styles.restoreDescription}>
          保存したJSONファイルから、時間割と学習データを復元します。現在の写真と写真OCRは変更しません。
        </Text>

        <Pressable
          style={[
            styles.restoreButton,
            restoring && styles.exportButtonDisabled,
          ]}
          disabled={restoring}
          onPress={() => void selectBackupFile()}
        >
          {restoring ? (
            <ActivityIndicator color="white" />
          ) : null}
          <Text style={styles.exportButtonText}>
            {restoring
              ? '復元中...'
              : 'バックアップファイルを選択'}
          </Text>
        </Pressable>

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
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 28 },
  restoreTitle: { color: '#222', fontSize: 20, fontWeight: 'bold' },
  restoreDescription: { color: '#555', fontSize: 13, lineHeight: 21, marginTop: 8 },
  restoreButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#8a5a20', borderRadius: 10, padding: 15, marginTop: 16 },
  successText: { color: '#28794c', fontSize: 13, textAlign: 'center', marginTop: 16 },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 16 },
});
