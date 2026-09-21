import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  createExamPreparation,
  getLectureSummaryAvailability,
  type LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import {
  loadExamPreparationRecords,
  saveExamPreparationRecord,
} from '@/services/exam-preparation-storage';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import {
  buildExamPreparationSource,
  createExamPreparationRecordId,
  createExamPreparationSourceSignature,
} from '@/types/exam-preparation';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


const getDateLabel = (dateKey: string) => {
  const [, month, day] = dateKey.split('-');

  if (month === undefined || day === undefined) {
    return dateKey;
  }

  return `${Number(month)}月${Number(day)}日`;
};


export default function ExamPreparationScreen() {
  const params = useLocalSearchParams();
  const subject =
    typeof params.subject === 'string'
      ? params.subject
      : '';

  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [availability, setAvailability] =
    useState<LectureSummaryAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [examPreparation, setExamPreparation] =
    useState('');
  const [generationError, setGenerationError] =
    useState('');
  const [isGenerating, setIsGenerating] =
    useState(false);
  const [saveError, setSaveError] = useState('');
  const [isExamPreparationSaved, setIsExamPreparationSaved] =
    useState(false);


  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        try {
          setLoading(true);
          setLoadError('');
          setGenerationError('');
          setSaveError('');

          const [
            records,
            modelAvailability,
            savedExamPreparations,
          ] =
            await Promise.all([
              loadLectureSummaryRecords(),
              getLectureSummaryAvailability(),
              loadExamPreparationRecords(),
            ]);

          if (!active) {
            return;
          }

          const subjectSummaries = Object.values(records)
            .filter((record) => record.subject === subject)
            .sort((a, b) =>
              a.dateKey.localeCompare(b.dateKey)
            );

          setSummaries(subjectSummaries);
          setAvailability(modelAvailability);

          const sourceSummarySignature =
            createExamPreparationSourceSignature(
              subjectSummaries
            );
          const savedExamPreparation =
            savedExamPreparations[
              createExamPreparationRecordId(subject)
            ];
          const canUseSavedExamPreparation =
            savedExamPreparation !== undefined &&
            savedExamPreparation.sourceSummarySignature ===
              sourceSummarySignature;

          setExamPreparation(
            canUseSavedExamPreparation
              ? savedExamPreparation.text
              : ''
          );
          setIsExamPreparationSaved(
            canUseSavedExamPreparation
          );
        } catch (error) {
          console.log('試験対策読み込みエラー:', error);

          if (active) {
            setLoadError(
              '授業まとめを読み込めませんでした。'
            );
            setAvailability('unknown');
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void loadData();

      return () => {
        active = false;
      };
    }, [subject])
  );


  const generateExamPreparation = async () => {
    if (
      summaries.length === 0 ||
      availability !== 'available' ||
      isGenerating
    ) {
      return;
    }

    const source = buildExamPreparationSource(summaries);

    if (source === '') {
      setGenerationError(
        '試験対策に使える授業まとめがありません。'
      );
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationError('');
      setSaveError('');
      setIsExamPreparationSaved(false);

      const result = await createExamPreparation(source);
      const trimmedResult = result.trim();

      if (trimmedResult === '') {
        throw new Error('生成された試験対策が空です');
      }

      setExamPreparation(trimmedResult);

      try {
        await saveExamPreparationRecord(
          subject,
          trimmedResult,
          createExamPreparationSourceSignature(
            summaries
          )
        );
        setIsExamPreparationSaved(true);
      } catch (saveExamPreparationError) {
        console.log(
          '試験対策保存エラー:',
          saveExamPreparationError
        );
        setSaveError(
          '試験対策は表示できましたが、端末に保存できませんでした。'
        );
      }
    } catch (error) {
      console.log('試験対策作成エラー:', error);
      setGenerationError(
        '試験対策を作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setIsGenerating(false);
    }
  };


  const getUnavailableMessage = () => {
    switch (availability) {
      case 'unsupportedBuild':
        return '試験対策機能を利用するには、開発ビルドの再インストールが必要です。';
      case 'unsupportedOS':
        return '端末内AI試験対策にはiOS 26以降が必要です。';
      case 'deviceNotEligible':
        return 'この端末はApple Intelligenceに対応していません。';
      case 'appleIntelligenceNotEnabled':
        return 'iPhoneの設定でApple Intelligenceを有効にしてください。';
      case 'modelNotReady':
        return 'Apple Intelligenceのモデルを準備中です。しばらく待ってから再試行してください。';
      case 'unknown':
        return '端末内AI試験対策を現在利用できません。';
      default:
        return '';
    }
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '試験対策',
          headerBackTitle: '復習',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>
          {subject}
        </Text>

        <Text style={styles.subtitle}>
          試験対策まとめ
        </Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#31518f" />
            <Text style={styles.loadingText}>
              授業まとめを読み込み中...
            </Text>
          </View>
        ) : null}

        {loadError !== '' ? (
          <Text style={styles.errorText}>
            {loadError}
          </Text>
        ) : null}

        {!loading && loadError === '' ? (
          <>
            <View style={styles.sourceCard}>
              <Text style={styles.sourceTitle}>
                使用する授業まとめ
              </Text>

              <Text style={styles.sourceCount}>
                {summaries.length}回分
              </Text>

              {summaries.map((summary, index) => (
                <Text
                  key={summary.id}
                  style={styles.sourceItem}
                >
                  第{index + 1}回・{getDateLabel(summary.dateKey)}
                </Text>
              ))}
            </View>

            <Text style={styles.notice}>
              保存済みの授業回まとめを外部に送信せず、このiPhone内で処理します。実際の試験範囲や出題を保証するものではありません。
            </Text>

            {availability === null ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#31518f" />
                <Text style={styles.loadingText}>
                  端末内AIを確認中...
                </Text>
              </View>
            ) : availability === 'available' ? (
              <Pressable
                style={[
                  styles.generateButton,
                  (isGenerating || summaries.length === 0) &&
                    styles.disabledButton,
                ]}
                disabled={
                  isGenerating || summaries.length === 0
                }
                onPress={() => {
                  void generateExamPreparation();
                }}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" />
                ) : null}

                <Text style={styles.generateButtonText}>
                  {isGenerating
                    ? '試験対策を作成中...'
                    : examPreparation === ''
                      ? '試験対策を作成'
                      : '試験対策を作り直す'}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.unavailableText}>
                {getUnavailableMessage()}
              </Text>
            )}

            {generationError !== '' ? (
              <Text style={styles.errorText}>
                {generationError}
              </Text>
            ) : null}

            {saveError !== '' ? (
              <Text style={styles.errorText}>
                {saveError}
              </Text>
            ) : null}

            {examPreparation !== '' ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>
                  試験対策
                </Text>

                {isExamPreparationSaved ? (
                  <Text style={styles.savedText}>
                    端末に保存済み
                  </Text>
                ) : null}

                <Text
                  style={styles.resultText}
                  selectable
                >
                  {examPreparation}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
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
    padding: 22,
    paddingBottom: 48,
  },

  title: {
    color: '#111',
    fontSize: 28,
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#555',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  loadingText: {
    color: '#555',
    fontSize: 13,
    marginLeft: 8,
  },

  sourceCard: {
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 12,
    padding: 15,
  },

  sourceTitle: {
    color: '#31518f',
    fontSize: 16,
    fontWeight: 'bold',
  },

  sourceCount: {
    color: '#555',
    fontSize: 13,
    marginTop: 5,
    marginBottom: 8,
  },

  sourceItem: {
    color: '#333',
    fontSize: 13,
    lineHeight: 21,
  },

  notice: {
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 19,
    padding: 11,
    marginTop: 14,
  },

  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#31518f',
    borderRadius: 9,
    padding: 13,
    marginTop: 14,
  },

  generateButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.6,
  },

  unavailableText: {
    color: '#725b24',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },

  errorText: {
    color: '#9b2c2c',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },

  resultCard: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
    marginTop: 18,
  },

  resultTitle: {
    color: '#28794c',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  savedText: {
    color: '#28794c',
    fontSize: 11,
    marginTop: -6,
    marginBottom: 9,
  },

  resultText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 23,
  },
});
