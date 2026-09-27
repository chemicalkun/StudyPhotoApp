import { useEffect, useState } from 'react';
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
import {
  router,
  Stack,
  useLocalSearchParams,
} from 'expo-router';

import {
  createBackupFile,
  getBackupOverview,
  loadLastBackupExportedAt,
  restoreBackup,
  saveLastBackupExportedAt,
} from '@/services/backup-storage';
import {
  formatAcademicTerm,
  parseAcademicTerm,
} from '@/types/academic-term';
import { parseStudyPhotoBackup } from '@/types/backup';


export default function BackupScreen() {
  const params = useLocalSearchParams();
  const openedFromSettings = params.from === 'settings';
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [restoreCompleted, setRestoreCompleted] =
    useState(false);
  const [lastBackupExportedAt, setLastBackupExportedAt] =
    useState<string | null | undefined>(undefined);


  useEffect(() => {
    let active = true;

    const loadLastExportedAt = async () => {
      try {
        const savedExportedAt =
          await loadLastBackupExportedAt();

        if (active) {
          setLastBackupExportedAt(savedExportedAt);
        }
      } catch (error) {
        console.log(
          '最終バックアップ日時読み込みエラー:',
          error
        );

        if (active) {
          setLastBackupExportedAt(null);
        }
      }
    };

    void loadLastExportedAt();

    return () => {
      active = false;
    };
  }, []);


  const exportBackup = async () => {
    if (exporting || restoring) {
      return;
    }

    try {
      setExporting(true);
      setErrorMessage('');
      setStatusMessage('');
      setRestoreCompleted(false);

      const fileUri = await createBackupFile();
      const result = await Share.share({
        title: 'StudyPhotoバックアップ',
        url: fileUri,
      });

      if (result.action === Share.sharedAction) {
        const exportedAt = new Date().toISOString();

        await saveLastBackupExportedAt(exportedAt);
        setLastBackupExportedAt(exportedAt);
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
    if (exporting || restoring) {
      return;
    }

    try {
      setRestoring(true);
      setErrorMessage('');
      setStatusMessage('');
      setRestoreCompleted(false);

      await restoreBackup(savedBackup);
      setStatusMessage(
        '設定と学習データを復元しました。現在の写真情報と写真OCRは変更していません。'
      );
      setRestoreCompleted(true);
    } catch (error) {
      console.log('バックアップ復元エラー:', error);
      setRestoreCompleted(false);
      setErrorMessage(
        'バックアップを復元できませんでした。ファイルが壊れている可能性があります。'
      );
    } finally {
      setRestoring(false);
    }
  };


  const selectBackupFile = async () => {
    if (exporting || restoring) {
      return;
    }

    try {
      setErrorMessage('');
      setStatusMessage('');
      setRestoreCompleted(false);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (!selectedAsset) {
        throw new Error(
          '選択したバックアップファイルがありません'
        );
      }

      const selectedFile = new File(selectedAsset.uri);
      const savedBackup = await selectedFile.text();
      const backup = parseStudyPhotoBackup(savedBackup);
      const backupOverview = getBackupOverview(backup);
      const exportedAt = new Date(
        backup.exportedAt
      ).toLocaleString('ja-JP');
      const academicTermLabel =
        backup.storage.academicTerm !== null
          ? formatAcademicTerm(
              parseAcademicTerm(
                backup.storage.academicTerm
              )
            )
          : '学年・学期情報なし';

      Alert.alert(
        'バックアップを復元しますか？',
        `ファイル：${selectedAsset.name}\n作成日時：${exportedAt}\n保存学期：${backupOverview.academicTermCount}学期\n選択中の学期：${academicTermLabel}\n授業まとめ：${backupOverview.lectureSummaryCount}件\n試験対策：${backupOverview.examPreparationCount}件\n\n現在の時間割と学習データは上書きされます。写真画像・写真情報・写真OCRは変更しません。`,
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

        <View style={styles.lastBackupCard}>
          <Text style={styles.lastBackupLabel}>
            前回の書き出し
          </Text>
          <Text style={styles.lastBackupValue}>
            {lastBackupExportedAt === undefined
              ? '確認中...'
              : lastBackupExportedAt === null
                ? 'まだありません'
                : new Date(
                    lastBackupExportedAt
                  ).toLocaleString('ja-JP')}
          </Text>
        </View>

        <View style={styles.includedCard}>
          <Text style={styles.cardTitle}>
            ファイルに記録されるデータ
          </Text>
          <Text style={styles.cardText}>
            学年・学期・時間割・時限設定・授業まとめ・試験対策・練習問題・フラッシュカード・質問履歴
            {'\n\n'}
            写真情報と写真OCRも、参照用としてファイルに記録されます。
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            写真の取り扱い
          </Text>
          <Text style={styles.warningText}>
            写真画像そのものはファイルに含まれません。復元時は、この端末にある現在の写真情報と写真OCRを保護し、バックアップ内のデータで上書きしません。
          </Text>
        </View>

        <Pressable
          style={[
            styles.exportButton,
            (exporting || restoring) &&
              styles.exportButtonDisabled,
          ]}
          disabled={exporting || restoring}
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
          保存したJSONファイルから、時間割と学習データを復元します。現在の写真画像・写真情報・写真OCRは変更しません。
        </Text>

        <Pressable
          style={[
            styles.restoreButton,
            (exporting || restoring) &&
              styles.exportButtonDisabled,
          ]}
          disabled={exporting || restoring}
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

        {restoreCompleted ? (
          <Pressable
            style={styles.returnHomeButton}
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.returnHomeButtonText}>
              ホームで復元内容を確認
            </Text>
          </Pressable>
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
  lastBackupCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f6f8', borderWidth: 1, borderColor: '#d9dde5', borderRadius: 12, padding: 14, marginBottom: 14 },
  lastBackupLabel: { color: '#444', fontSize: 13, fontWeight: 'bold' },
  lastBackupValue: { color: '#555', fontSize: 13, marginLeft: 12 },
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
  returnHomeButton: { alignItems: 'center', borderWidth: 1, borderColor: '#28794c', borderRadius: 10, padding: 13, marginTop: 12 },
  returnHomeButtonText: { color: '#28794c', fontSize: 14, fontWeight: 'bold' },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 16 },
});
