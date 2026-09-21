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
  createPracticeQuestions,
  getLectureSummaryAvailability,
  type LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import {
  loadPracticeQuestionRecords,
  savePracticeQuestionRecord,
} from '@/services/practice-question-storage';
import {
  buildExamPreparationSource,
} from '@/types/exam-preparation';
import {
  createPracticeQuestionRecordId,
  createPracticeQuestionSourceSignature,
  type PracticeQuestion,
} from '@/types/practice-question';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export default function PracticeQuestionScreen() {
  const params = useLocalSearchParams();
  const subject =
    typeof params.subject === 'string'
      ? params.subject
      : '';

  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [questions, setQuestions] =
    useState<PracticeQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [availability, setAvailability] =
    useState<LectureSummaryAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [generationError, setGenerationError] =
    useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaved, setIsSaved] = useState(false);


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
            summaryRecords,
            modelAvailability,
            practiceRecords,
          ] = await Promise.all([
            loadLectureSummaryRecords(),
            getLectureSummaryAvailability(),
            loadPracticeQuestionRecords(),
          ]);

          if (!active) {
            return;
          }

          const subjectSummaries = Object.values(
            summaryRecords
          )
            .filter((record) => record.subject === subject)
            .sort((a, b) =>
              a.dateKey.localeCompare(b.dateKey)
            );
          const savedRecord = practiceRecords[
            createPracticeQuestionRecordId(subject)
          ];
          const sourceSignature =
            createPracticeQuestionSourceSignature(
              subjectSummaries
            );
          const canUseSavedRecord =
            savedRecord !== undefined &&
            savedRecord.sourceSummarySignature ===
              sourceSignature;

          setSummaries(subjectSummaries);
          setAvailability(modelAvailability);
          setQuestions(
            canUseSavedRecord ? savedRecord.questions : []
          );
          setIsSaved(canUseSavedRecord);
          setCurrentQuestionIndex(0);
          setShowAnswer(false);
        } catch (error) {
          console.log('練習問題読み込みエラー:', error);

          if (active) {
            setLoadError(
              '授業まとめまたは練習問題を読み込めませんでした。'
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


  const generateQuestions = async () => {
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
        '練習問題に使える授業まとめがありません。'
      );
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationError('');
      setSaveError('');
      setIsSaved(false);

      const generatedQuestions =
        await createPracticeQuestions(source);
      const validQuestions = generatedQuestions
        .map((question) => ({
          question: question.question.trim(),
          answer: question.answer.trim(),
        }))
        .filter(
          (question) =>
            question.question !== '' &&
            question.answer !== ''
        );

      if (validQuestions.length === 0) {
        throw new Error('生成された練習問題が空です');
      }

      setQuestions(validQuestions);
      setCurrentQuestionIndex(0);
      setShowAnswer(false);

      try {
        await savePracticeQuestionRecord(
          subject,
          validQuestions,
          createPracticeQuestionSourceSignature(summaries)
        );
        setIsSaved(true);
      } catch (storageError) {
        console.log('練習問題保存エラー:', storageError);
        setSaveError(
          '練習問題は表示できますが、端末に保存できませんでした。'
        );
      }
    } catch (error) {
      console.log('練習問題作成エラー:', error);
      setGenerationError(
        '練習問題を作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setIsGenerating(false);
    }
  };


  const getUnavailableMessage = () => {
    switch (availability) {
      case 'unsupportedBuild':
        return '練習問題機能を利用するには、開発ビルドの再インストールが必要です。';
      case 'unsupportedOS':
        return '端末内AI練習問題にはiOS 26以降が必要です。';
      case 'deviceNotEligible':
        return 'この端末はApple Intelligenceに対応していません。';
      case 'appleIntelligenceNotEnabled':
        return 'iPhoneの設定でApple Intelligenceを有効にしてください。';
      case 'modelNotReady':
        return 'Apple Intelligenceのモデルを準備中です。しばらく待ってから再試行してください。';
      case 'unknown':
        return '端末内AI練習問題を現在利用できません。';
      default:
        return '';
    }
  };


  const currentQuestion =
    questions[currentQuestionIndex] ?? null;


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '練習問題',
          headerBackTitle: '試験対策',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>{subject}</Text>
        <Text style={styles.subtitle}>練習問題</Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#31518f" />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        ) : null}

        {loadError !== '' ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : null}

        {!loading && loadError === '' ? (
          <>
            <Text style={styles.notice}>
              {summaries.length}回分の保存済みまとめから、このiPhone内で5問作成します。
            </Text>

            {availability === 'available' ? (
              <Pressable
                style={[
                  styles.generateButton,
                  (isGenerating || summaries.length === 0) &&
                    styles.disabledButton,
                ]}
                disabled={
                  isGenerating || summaries.length === 0
                }
                onPress={() => void generateQuestions()}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" />
                ) : null}
                <Text style={styles.generateButtonText}>
                  {isGenerating
                    ? '練習問題を作成中...'
                    : questions.length === 0
                      ? '練習問題を作成'
                      : '練習問題を作り直す'}
                </Text>
              </Pressable>
            ) : availability === null ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#31518f" />
                <Text style={styles.loadingText}>
                  端末内AIを確認中...
                </Text>
              </View>
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
              <Text style={styles.errorText}>{saveError}</Text>
            ) : null}

            {currentQuestion !== null ? (
              <View style={styles.questionSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    問題 {currentQuestionIndex + 1} /{' '}
                    {questions.length}
                  </Text>
                  {isSaved ? (
                    <Text style={styles.savedText}>端末に保存済み</Text>
                  ) : null}
                </View>

                <View style={styles.questionCard}>
                  <Text style={styles.questionLabel}>問題</Text>
                  <Text style={styles.questionText} selectable>
                    {currentQuestion.question}
                  </Text>

                  {showAnswer ? (
                    <View style={styles.answerBox}>
                      <Text style={styles.answerLabel}>答え</Text>
                      <Text style={styles.answerText} selectable>
                        {currentQuestion.answer}
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.answerButton}
                      onPress={() => setShowAnswer(true)}
                    >
                      <Text style={styles.answerButtonText}>
                        答えを見る
                      </Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.navigationRow}>
                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentQuestionIndex === 0 &&
                        styles.disabledButton,
                    ]}
                    disabled={currentQuestionIndex === 0}
                    onPress={() => {
                      setCurrentQuestionIndex((index) => index - 1);
                      setShowAnswer(false);
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      前の問題
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentQuestionIndex ===
                        questions.length - 1 &&
                        styles.disabledButton,
                    ]}
                    disabled={
                      currentQuestionIndex ===
                      questions.length - 1
                    }
                    onPress={() => {
                      setCurrentQuestionIndex((index) => index + 1);
                      setShowAnswer(false);
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      次の問題
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
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
  subtitle: { color: '#555', fontSize: 17, marginTop: 6, marginBottom: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  loadingText: { color: '#555', fontSize: 14 },
  notice: { color: '#555', backgroundColor: '#f3f6ff', borderRadius: 10, fontSize: 13, lineHeight: 20, padding: 13 },
  generateButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#31518f', borderRadius: 10, padding: 14, marginTop: 14 },
  generateButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  disabledButton: { opacity: 0.45 },
  unavailableText: { color: '#725b24', backgroundColor: '#fff3d6', borderRadius: 8, fontSize: 13, lineHeight: 20, padding: 12, marginTop: 14 },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, marginTop: 12 },
  questionSection: { marginTop: 22 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { color: '#333', fontSize: 14, fontWeight: 'bold' },
  savedText: { color: '#28794c', fontSize: 11 },
  questionCard: { backgroundColor: '#eef8f2', borderWidth: 1, borderColor: '#9bc9aa', borderRadius: 14, padding: 18, marginTop: 10 },
  questionLabel: { color: '#28794c', fontSize: 13, fontWeight: 'bold' },
  questionText: { color: '#1d1d1d', fontSize: 18, fontWeight: 'bold', lineHeight: 28, marginTop: 8 },
  answerButton: { backgroundColor: '#28794c', borderRadius: 9, padding: 12, marginTop: 20 },
  answerButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  answerBox: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginTop: 18 },
  answerLabel: { color: '#28794c', fontSize: 13, fontWeight: 'bold' },
  answerText: { color: '#222', fontSize: 15, lineHeight: 23, marginTop: 6 },
  navigationRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navigationButton: { flex: 1, backgroundColor: '#333', borderRadius: 9, padding: 12 },
  navigationButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
