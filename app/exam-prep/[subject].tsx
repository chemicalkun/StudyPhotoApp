import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import { HeaderBackButton } from '@react-navigation/elements';

import { LoadErrorCard } from '@/components/load-error-card';
import {
  answerLectureQuestion,
  createExamPreparation,
  getLectureSummaryAvailability,
  type LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import {
  loadExamPreparationRecords,
  saveExamPreparationRecord,
  updateExamPreparationText,
} from '@/services/exam-preparation-storage';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import {
  deleteSubjectQuestionRecord,
  loadSubjectQuestionRecords,
  saveSubjectQuestionRecord,
} from '@/services/subject-question-storage';
import {
  buildExamPreparationSource,
  createExamPreparationRecordId,
  createExamPreparationSourceSignature,
} from '@/types/exam-preparation';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';
import {
  createSubjectQuestionSourceSignature,
  type SubjectQuestionRecord,
} from '@/types/subject-question';


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
  const [selectedSourceSummary, setSelectedSourceSummary] =
    useState<LectureSummaryRecord | null>(null);
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
  const [shareError, setShareError] = useState('');
  const [isExamPreparationSaved, setIsExamPreparationSaved] =
    useState(false);
  const [isExamPreparationOutdated, setIsExamPreparationOutdated] =
    useState(false);
  const [isExamPreparationExpanded, setIsExamPreparationExpanded] =
    useState(false);
  const [isEditingExamPreparation, setIsEditingExamPreparation] =
    useState(false);
  const editedExamPreparationRef = useRef('');
  const [examPreparationEditError, setExamPreparationEditError] =
    useState('');
  const [isSavingExamPreparation, setIsSavingExamPreparation] =
    useState(false);
  const questionTextRef = useRef('');
  const [hasQuestionText, setHasQuestionText] = useState(false);
  const [isAnsweringQuestion, setIsAnsweringQuestion] =
    useState(false);
  const [questionError, setQuestionError] = useState('');
  const [questionSaveError, setQuestionSaveError] =
    useState('');
  const [subjectAnswer, setSubjectAnswer] = useState('');
  const [questionHistory, setQuestionHistory] =
    useState<SubjectQuestionRecord[]>([]);
  const [isQuestionHistoryExpanded, setIsQuestionHistoryExpanded] =
    useState(false);
  const [expandedQuestionId, setExpandedQuestionId] =
    useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);


  useEffect(() => {
    void loadRevision;
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setLoadError('');
        setGenerationError('');
        setSaveError('');
        setShareError('');
        setQuestionError('');
        setQuestionSaveError('');
        setIsQuestionHistoryExpanded(false);
        setExpandedQuestionId(null);
        setIsExamPreparationExpanded(false);
        setIsEditingExamPreparation(false);
        setExamPreparationEditError('');
        setIsSavingExamPreparation(false);

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
        const hasSavedExamPreparation =
          savedExamPreparation !== undefined;
        const savedExamPreparationIsCurrent =
          savedExamPreparation !== undefined &&
          savedExamPreparation.sourceSummarySignature ===
            sourceSummarySignature;

        setExamPreparation(
          hasSavedExamPreparation
            ? savedExamPreparation.text
            : ''
        );
        editedExamPreparationRef.current =
          hasSavedExamPreparation
            ? savedExamPreparation.text
            : '';
        setIsExamPreparationSaved(
          hasSavedExamPreparation
        );
        setIsExamPreparationOutdated(
          hasSavedExamPreparation &&
            !savedExamPreparationIsCurrent
        );

        try {
          const savedQuestionRecords =
            await loadSubjectQuestionRecords();

          if (active) {
            setQuestionHistory(
              Object.values(savedQuestionRecords)
                .filter(
                  (record) => record.subject === subject
                )
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
            );
          }
        } catch (questionHistoryError) {
          console.log(
            '質問履歴読み込みエラー:',
            questionHistoryError
          );

          if (active) {
            setQuestionHistory([]);
          }
        }
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
  }, [loadRevision, subject]);


  const generateExamPreparation = async () => {
    if (
      summaries.length === 0 ||
      availability !== 'available' ||
      isGenerating ||
      isEditingExamPreparation ||
      isSavingExamPreparation
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
      setShareError('');
      setIsExamPreparationSaved(false);
      setIsExamPreparationOutdated(false);

      const result = await createExamPreparation(source);
      const trimmedResult = result.trim();

      if (trimmedResult === '') {
        throw new Error('生成された試験対策が空です');
      }

      setExamPreparation(trimmedResult);
      editedExamPreparationRef.current = trimmedResult;
      setIsEditingExamPreparation(false);
      setExamPreparationEditError('');
      setIsExamPreparationExpanded(true);

      try {
        await saveExamPreparationRecord(
          subject,
          trimmedResult,
          createExamPreparationSourceSignature(
            summaries
          )
        );
        setIsExamPreparationSaved(true);
        setIsExamPreparationOutdated(false);
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


  const shareExamPreparation = async () => {
    if (examPreparation === '') {
      return;
    }

    try {
      setShareError('');

      await Share.share({
        title: `${subject}の試験対策`,
        message: `${subject}の試験対策\n\n${examPreparation}`,
      });
    } catch (error) {
      console.log('試験対策共有エラー:', error);
      setShareError(
        '試験対策を共有できませんでした。もう一度お試しください。'
      );
    }
  };


  const saveEditedExamPreparation = async () => {
    if (isSavingExamPreparation) {
      return;
    }

    const trimmedText =
      editedExamPreparationRef.current.trim();

    if (trimmedText === '') {
      setExamPreparationEditError(
        '試験対策本文を入力してください。'
      );
      return;
    }

    try {
      setIsSavingExamPreparation(true);
      setExamPreparationEditError('');

      const recordId =
        createExamPreparationRecordId(subject);
      const savedRecord = isExamPreparationSaved
        ? await updateExamPreparationText(
            recordId,
            trimmedText
          )
        : await saveExamPreparationRecord(
            subject,
            trimmedText,
            createExamPreparationSourceSignature(
              summaries
            )
          );

      setExamPreparation(savedRecord.text);
      editedExamPreparationRef.current = savedRecord.text;
      setIsExamPreparationSaved(true);
      setIsEditingExamPreparation(false);

      if (!isExamPreparationSaved) {
        setIsExamPreparationOutdated(false);
      }
    } catch (error) {
      console.log('試験対策編集エラー:', error);
      setExamPreparationEditError(
        '試験対策を保存できませんでした。もう一度お試しください。'
      );
    } finally {
      setIsSavingExamPreparation(false);
    }
  };


  const askSubjectQuestion = async (
    questionOverride?: string
  ) => {
    if (
      summaries.length === 0 ||
      availability !== 'available' ||
      isAnsweringQuestion
    ) {
      return;
    }

    const question = (
      questionOverride ?? questionTextRef.current
    ).trim();

    if (question === '') {
      setQuestionError('質問を入力してください。');
      return;
    }

    const source = buildExamPreparationSource(summaries);

    if (source === '') {
      setQuestionError(
        '質問に使える授業まとめがありません。'
      );
      return;
    }

    try {
      setIsAnsweringQuestion(true);
      setQuestionError('');
      setQuestionSaveError('');
      setSubjectAnswer('');

      const answer = await answerLectureQuestion(
        source,
        question
      );
      const trimmedAnswer = answer.trim();

      if (trimmedAnswer === '') {
        throw new Error('生成された回答が空です');
      }

      try {
        const savedQuestion = await saveSubjectQuestionRecord(
          subject,
          question,
          trimmedAnswer,
          createSubjectQuestionSourceSignature(summaries)
        );

        setQuestionHistory((currentHistory) => [
          savedQuestion,
          ...currentHistory,
        ]);
        setIsQuestionHistoryExpanded(true);
        setExpandedQuestionId(savedQuestion.id);
      } catch (saveQuestionError) {
        console.log('質問履歴保存エラー:', saveQuestionError);
        setSubjectAnswer(trimmedAnswer);
        setQuestionSaveError(
          '回答は表示できますが、質問履歴を保存できませんでした。'
        );
      }
    } catch (error) {
      console.log('授業全体質問エラー:', error);
      setQuestionError(
        '回答を作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setIsAnsweringQuestion(false);
    }
  };


  const deleteQuestionHistory = async (
    record: SubjectQuestionRecord
  ) => {
    try {
      setQuestionSaveError('');
      await deleteSubjectQuestionRecord(record.id);
      setQuestionHistory((currentHistory) =>
        currentHistory.filter(
          (candidate) => candidate.id !== record.id
        )
      );
      setExpandedQuestionId((currentId) =>
        currentId === record.id ? null : currentId
      );
    } catch (error) {
      console.log('質問履歴削除エラー:', error);
      setQuestionSaveError(
        '質問履歴を削除できませんでした。もう一度お試しください。'
      );
    }
  };


  const shareQuestionHistory = async (
    record: SubjectQuestionRecord
  ) => {
    try {
      setQuestionSaveError('');

      await Share.share({
        title: `${subject}の質問と回答`,
        message: `${subject}\n\nQ. ${record.question}\n\nA. ${record.answer}`,
      });
    } catch (error) {
      console.log('質問履歴共有エラー:', error);
      setQuestionSaveError(
        '質問と回答を共有できませんでした。もう一度お試しください。'
      );
    }
  };


  const confirmDeleteQuestionHistory = (
    record: SubjectQuestionRecord
  ) => {
    Alert.alert(
      'この質問履歴を削除しますか？',
      '質問と回答の両方が削除されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            void deleteQuestionHistory(record);
          },
        },
      ]
    );
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
          headerBackVisible: false,
          headerLeft: (props) => (
            <HeaderBackButton
              {...props}
              label="復習"
              tintColor="#111"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace('/explore');
              }}
            />
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
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
          <LoadErrorCard
            message={loadError}
            onRetry={() => {
              setLoadRevision(
                (revision) => revision + 1
              );
            }}
          />
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
                <Pressable
                  key={summary.id}
                  style={styles.sourceItem}
                  accessibilityRole="button"
                  accessibilityLabel={`第${index + 1}回の授業まとめを開く`}
                  onPress={() => {
                    setSelectedSourceSummary(summary);
                  }}
                >
                  <Text style={styles.sourceItemText}>
                    第{index + 1}回・{getDateLabel(summary.dateKey)}
                  </Text>
                  <Text style={styles.sourceItemOpenText}>
                    まとめを見る ›
                  </Text>
                </Pressable>
              ))}

              {isExamPreparationOutdated &&
              availability === 'available' ? (
                <Pressable
                  style={[
                    styles.sourceRefreshButton,
                    (isGenerating ||
                      isEditingExamPreparation ||
                      isSavingExamPreparation) &&
                      styles.disabledButton,
                  ]}
                  disabled={
                    isGenerating ||
                    isEditingExamPreparation ||
                    isSavingExamPreparation
                  }
                  accessibilityRole="button"
                  accessibilityLabel="更新された授業まとめから試験対策を作り直す"
                  onPress={() => {
                    void generateExamPreparation();
                  }}
                >
                  {isGenerating ? (
                    <ActivityIndicator color="white" />
                  ) : null}
                  <Text style={styles.sourceRefreshButtonText}>
                    {isGenerating
                      ? '試験対策を作成中...'
                      : '更新されたまとめから作り直す'}
                  </Text>
                </Pressable>
              ) : null}
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
              <>
                <Pressable
                  style={[
                    styles.generateButton,
                    (isGenerating ||
                      summaries.length === 0 ||
                      isEditingExamPreparation ||
                      isSavingExamPreparation) &&
                      styles.disabledButton,
                  ]}
                  disabled={
                    isGenerating ||
                    summaries.length === 0 ||
                    isEditingExamPreparation ||
                    isSavingExamPreparation
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

                <Pressable
                  style={[
                    styles.practiceButton,
                    summaries.length === 0 &&
                      styles.disabledButton,
                  ]}
                  disabled={summaries.length === 0}
                  onPress={() => {
                    router.push({
                      pathname: '/practice/[subject]',
                      params: { subject },
                    });
                  }}
                >
                  <Text style={styles.practiceButtonText}>
                    練習問題に挑戦
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.flashcardButton,
                    summaries.length === 0 &&
                      styles.disabledButton,
                  ]}
                  disabled={summaries.length === 0}
                  onPress={() => {
                    router.push({
                      pathname: '/flashcards/[subject]',
                      params: { subject },
                    });
                  }}
                >
                  <Text style={styles.flashcardButtonText}>
                    フラッシュカードで覚える
                  </Text>
                </Pressable>
              </>
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

            {shareError !== '' ? (
              <Text style={styles.errorText}>
                {shareError}
              </Text>
            ) : null}

            {availability === 'available' ? (
              <View style={styles.questionSection}>
                <Text style={styles.questionTitle}>
                  この授業全体について質問
                </Text>

                <Text style={styles.questionDescription}>
                  保存済みの各回まとめを根拠に、端末内AIが回答します。
                </Text>

                <TextInput
                  style={styles.questionInput}
                  defaultValue={questionTextRef.current}
                  onChangeText={(text) => {
                    questionTextRef.current = text;
                    setHasQuestionText(text.trim() !== '');
                    setQuestionError('');
                  }}
                  placeholder="例：試験前に優先して覚える内容は？"
                  multiline
                  maxLength={500}
                  editable={!isAnsweringQuestion}
                  accessibilityLabel="授業全体への質問"
                />

                <Pressable
                  style={[
                    styles.questionButton,
                    (isAnsweringQuestion || !hasQuestionText) &&
                      styles.disabledButton,
                  ]}
                  disabled={
                    isAnsweringQuestion || !hasQuestionText
                  }
                  onPress={() => void askSubjectQuestion()}
                >
                  {isAnsweringQuestion ? (
                    <ActivityIndicator color="white" />
                  ) : null}
                  <Text style={styles.questionButtonText}>
                    {isAnsweringQuestion
                      ? '回答を作成中...'
                      : '質問する'}
                  </Text>
                </Pressable>

                {questionError !== '' ? (
                  <Text style={styles.errorText}>
                    {questionError}
                  </Text>
                ) : null}

                {questionSaveError !== '' ? (
                  <Text style={styles.errorText}>
                    {questionSaveError}
                  </Text>
                ) : null}

                {subjectAnswer !== '' ? (
                  <View style={styles.answerCard}>
                    <Text style={styles.answerTitle}>
                      回答
                    </Text>
                    <Text style={styles.answerText} selectable>
                      {subjectAnswer}
                    </Text>
                  </View>
                ) : null}

                {questionHistory.length > 0 ? (
                  <View style={styles.questionHistorySection}>
                    <Pressable
                      style={styles.questionHistoryHeader}
                      accessibilityRole="button"
                      accessibilityState={{
                        expanded: isQuestionHistoryExpanded,
                      }}
                      onPress={() => {
                        setIsQuestionHistoryExpanded(
                          (expanded) => !expanded
                        );
                      }}
                    >
                      <Text style={styles.questionHistoryTitle}>
                        これまでの質問（{questionHistory.length}件）
                      </Text>
                      <Text style={styles.expandText}>
                        {isQuestionHistoryExpanded ? '閉じる ▲' : '開く ▼'}
                      </Text>
                    </Pressable>

                    {isQuestionHistoryExpanded
                      ? questionHistory.map((record) => {
                          const isCurrent =
                            record.sourceSummarySignature ===
                            createSubjectQuestionSourceSignature(
                              summaries
                            );
                          const isExpanded =
                            expandedQuestionId === record.id;

                          return (
                            <View
                              key={record.id}
                              style={styles.questionHistoryCard}
                            >
                              <Pressable
                                style={styles.questionHistoryCardHeader}
                                accessibilityRole="button"
                                accessibilityState={{
                                  expanded: isExpanded,
                                }}
                                onPress={() => {
                                  setExpandedQuestionId(
                                    isExpanded ? null : record.id
                                  );
                                }}
                              >
                                <View style={styles.questionHistoryCardText}>
                                  <Text style={styles.questionHistoryDate}>
                                    {new Date(record.createdAt)
                                      .toLocaleString('ja-JP')}
                                  </Text>
                                  {!isCurrent ? (
                                    <Text style={styles.questionHistoryOutdated}>
                                      まとめ更新前の回答
                                    </Text>
                                  ) : null}
                                  <Text style={styles.historyQuestion}>
                                    Q. {record.question}
                                  </Text>
                                </View>

                                <Text style={styles.questionExpandMark}>
                                  {isExpanded ? '▲' : '▼'}
                                </Text>
                              </Pressable>

                              {isExpanded ? (
                                <View style={styles.historyAnswerSection}>
                                  <Text
                                    style={styles.historyAnswer}
                                    selectable
                                  >
                                    A. {record.answer}
                                  </Text>
                                  <View style={styles.historyActions}>
                                    {!isCurrent ? (
                                      <Pressable
                                        style={[
                                          styles.refreshHistoryButton,
                                          isAnsweringQuestion &&
                                            styles.disabledHistoryAction,
                                        ]}
                                        disabled={isAnsweringQuestion}
                                        accessibilityRole="button"
                                        accessibilityLabel="現在のまとめで同じ質問を聞き直す"
                                        onPress={() =>
                                          void askSubjectQuestion(
                                            record.question
                                          )
                                        }
                                      >
                                        <Text style={styles.refreshHistoryButtonText}>
                                          {isAnsweringQuestion
                                            ? '回答を作成中...'
                                            : '現在のまとめで聞き直す'}
                                        </Text>
                                      </Pressable>
                                    ) : null}
                                    <Pressable
                                      style={styles.shareHistoryButton}
                                      accessibilityRole="button"
                                      accessibilityLabel="この質問と回答を共有"
                                      onPress={() =>
                                        void shareQuestionHistory(
                                          record
                                        )
                                      }
                                    >
                                      <Text style={styles.shareHistoryButtonText}>
                                        質問と回答を共有
                                      </Text>
                                    </Pressable>
                                    <Pressable
                                      style={styles.deleteHistoryButton}
                                      accessibilityRole="button"
                                      accessibilityLabel="この質問履歴を削除"
                                      onPress={() =>
                                        confirmDeleteQuestionHistory(
                                          record
                                        )
                                      }
                                    >
                                      <Text style={styles.deleteHistoryButtonText}>
                                        この質問履歴を削除
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          );
                        })
                      : null}
                  </View>
                ) : null}
              </View>
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

                {isExamPreparationOutdated ? (
                  <Text style={styles.outdatedNotice}>
                    授業まとめが更新されています。この試験対策は更新前のまとめから作成されたものです。必要に応じて「試験対策を作り直す」を押してください。
                  </Text>
                ) : null}

                {isEditingExamPreparation ? (
                  <View>
                    <TextInput
                      style={styles.examPreparationEditInput}
                      defaultValue={
                        editedExamPreparationRef.current
                      }
                      onChangeText={(text) => {
                        editedExamPreparationRef.current = text;
                        setExamPreparationEditError('');
                      }}
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                      autoFocus
                      editable={!isSavingExamPreparation}
                      accessibilityLabel="試験対策本文"
                    />

                    {examPreparationEditError !== '' ? (
                      <Text style={styles.examPreparationEditError}>
                        {examPreparationEditError}
                      </Text>
                    ) : null}

                    <View style={styles.examPreparationEditActions}>
                      <Pressable
                        style={[
                          styles.saveExamPreparationEditButton,
                          isSavingExamPreparation &&
                            styles.disabledButton,
                        ]}
                        disabled={isSavingExamPreparation}
                        accessibilityRole="button"
                        onPress={() => {
                          void saveEditedExamPreparation();
                        }}
                      >
                        {isSavingExamPreparation ? (
                          <ActivityIndicator
                            size="small"
                            color="white"
                          />
                        ) : null}

                        <Text
                          style={styles.saveExamPreparationEditText}
                        >
                          {isSavingExamPreparation
                            ? '保存中...'
                            : '変更を保存'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.cancelExamPreparationEditButton}
                        disabled={isSavingExamPreparation}
                        accessibilityRole="button"
                        onPress={() => {
                          editedExamPreparationRef.current =
                            examPreparation;
                          setIsEditingExamPreparation(false);
                          setExamPreparationEditError('');
                        }}
                      >
                        <Text
                          style={styles.cancelExamPreparationEditText}
                        >
                          キャンセル
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={styles.examPreparationToggle}
                      accessibilityRole="button"
                      accessibilityState={{
                        expanded: isExamPreparationExpanded,
                      }}
                      onPress={() => {
                        setIsExamPreparationExpanded(
                          (expanded) => !expanded
                        );
                      }}
                    >
                      <Text style={styles.examPreparationToggleText}>
                        {isExamPreparationExpanded
                          ? '閉じる ▲'
                          : '開く ▼'}
                      </Text>
                    </Pressable>

                    {isExamPreparationExpanded ? (
                      <Text
                        style={styles.resultText}
                        selectable
                      >
                        {examPreparation}
                      </Text>
                    ) : null}

                    <View style={styles.examPreparationActions}>
                      <Pressable
                        style={styles.editExamPreparationButton}
                        accessibilityRole="button"
                        accessibilityLabel={`${subject}の試験対策を編集`}
                        onPress={() => {
                          editedExamPreparationRef.current =
                            examPreparation;
                          setExamPreparationEditError('');
                          setIsEditingExamPreparation(true);
                        }}
                      >
                        <Text
                          style={styles.editExamPreparationButtonText}
                        >
                          試験対策を編集
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.shareButton}
                        accessibilityRole="button"
                        accessibilityLabel={`${subject}の試験対策を共有`}
                        onPress={() => void shareExamPreparation()}
                      >
                        <Text style={styles.shareButtonText}>
                          試験対策を共有
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            {examPreparation !== '' ? (
              <>
                <Pressable
                  style={styles.practiceButton}
                  onPress={() => {
                    router.push({
                      pathname: '/practice/[subject]',
                      params: { subject },
                    });
                  }}
                >
                  <Text style={styles.practiceButtonText}>
                    練習問題に挑戦
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.flashcardButton}
                  onPress={() => {
                    router.push({
                      pathname: '/flashcards/[subject]',
                      params: { subject },
                    });
                  }}
                >
                  <Text style={styles.flashcardButtonText}>
                    フラッシュカードで覚える
                  </Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={selectedSourceSummary !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSourceSummary(null)}
      >
        <View style={styles.summaryModalBackground}>
          <View style={styles.summaryModalContent}>
            {selectedSourceSummary !== null ? (
              <>
                <Text style={styles.summaryModalTitle}>
                  第{summaries.findIndex(
                    (summary) =>
                      summary.id === selectedSourceSummary.id
                  ) + 1}回のまとめ
                </Text>

                <Text style={styles.summaryModalDate}>
                  {getDateLabel(selectedSourceSummary.dateKey)}
                </Text>

                <ScrollView style={styles.summaryModalScrollView}>
                  <Text
                    style={styles.summaryModalText}
                    selectable
                  >
                    {selectedSourceSummary.text}
                  </Text>
                </ScrollView>

                <Pressable
                  style={styles.summaryModalCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="授業まとめを閉じる"
                  onPress={() => setSelectedSourceSummary(null)}
                >
                  <Text style={styles.summaryModalCloseButtonText}>
                    閉じる
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  keyboardAvoidingView: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#d8e0f3',
    paddingVertical: 9,
  },

  sourceItemText: {
    flex: 1,
    color: '#333',
    fontSize: 13,
    lineHeight: 21,
  },

  sourceItemOpenText: {
    color: '#31518f',
    fontSize: 12,
    fontWeight: 'bold',
  },

  sourceRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#31518f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 13,
  },

  sourceRefreshButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  summaryModalBackground: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 22,
  },

  summaryModalContent: {
    maxHeight: '82%',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
  },

  summaryModalTitle: {
    color: '#222',
    fontSize: 20,
    fontWeight: 'bold',
  },

  summaryModalDate: {
    color: '#666',
    fontSize: 13,
    marginTop: 5,
    marginBottom: 14,
  },

  summaryModalScrollView: {
    flexShrink: 1,
  },

  summaryModalText: {
    color: '#292929',
    fontSize: 15,
    lineHeight: 24,
  },

  summaryModalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#31518f',
    borderRadius: 9,
    paddingVertical: 12,
    marginTop: 18,
  },

  summaryModalCloseButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
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

  practiceButton: {
    backgroundColor: '#28794c',
    borderRadius: 9,
    padding: 13,
    marginTop: 18,
  },

  practiceButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  flashcardButton: {
    backgroundColor: '#6b3ca0',
    borderRadius: 9,
    padding: 13,
    marginTop: 10,
  },

  flashcardButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
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

  outdatedNotice: {
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 19,
    padding: 10,
    marginBottom: 12,
  },

  resultText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 12,
  },

  examPreparationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dff2e6',
    borderRadius: 8,
    padding: 11,
  },

  examPreparationToggleText: {
    color: '#28794c',
    fontSize: 14,
    fontWeight: 'bold',
  },

  examPreparationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },

  editExamPreparationButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#28794c',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  editExamPreparationButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },

  examPreparationEditInput: {
    height: 300,
    color: '#222',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 23,
    padding: 12,
  },

  examPreparationEditError: {
    color: '#9b2c2c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  examPreparationEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },

  saveExamPreparationEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#28794c',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  saveExamPreparationEditText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },

  cancelExamPreparationEditButton: {
    borderWidth: 1,
    borderColor: '#8d8d8d',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  cancelExamPreparationEditText: {
    color: '#444',
    fontSize: 13,
    fontWeight: 'bold',
  },

  questionSection: {
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 12,
    padding: 16,
    marginTop: 18,
  },

  questionTitle: {
    color: '#31518f',
    fontSize: 17,
    fontWeight: 'bold',
  },

  questionDescription: {
    color: '#555',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },

  questionInput: {
    minHeight: 88,
    color: '#222',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#b8c4df',
    borderRadius: 8,
    fontSize: 15,
    lineHeight: 22,
    padding: 11,
    marginTop: 12,
  },

  questionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#31518f',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  questionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  answerCard: {
    backgroundColor: 'white',
    borderRadius: 9,
    padding: 13,
    marginTop: 12,
  },

  answerTitle: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
  },

  answerText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },

  questionHistorySection: {
    marginTop: 18,
  },

  questionHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e5ebf9',
    borderRadius: 9,
    padding: 12,
  },

  questionHistoryTitle: {
    flex: 1,
    color: '#31518f',
    fontSize: 15,
    fontWeight: 'bold',
  },

  expandText: {
    color: '#31518f',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  questionHistoryCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d5dceb',
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 8,
  },

  questionHistoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },

  questionHistoryCardText: {
    flex: 1,
  },

  questionExpandMark: {
    color: '#31518f',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  questionHistoryDate: {
    color: '#777',
    fontSize: 10,
  },

  questionHistoryOutdated: {
    alignSelf: 'flex-start',
    color: '#725b24',
    backgroundColor: '#fff3d6',
    borderRadius: 5,
    fontSize: 10,
    fontWeight: 'bold',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
  },

  historyQuestion: {
    color: '#222',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 21,
    marginTop: 8,
  },

  historyAnswerSection: {
    borderTopWidth: 1,
    borderTopColor: '#e1e5ef',
    padding: 12,
  },

  historyAnswer: {
    color: '#333',
    fontSize: 13,
    lineHeight: 21,
  },

  historyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  refreshHistoryButton: {
    borderWidth: 1,
    borderColor: '#8a6a20',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  refreshHistoryButtonText: {
    color: '#725b24',
    fontSize: 12,
    fontWeight: 'bold',
  },

  disabledHistoryAction: {
    opacity: 0.5,
  },

  shareHistoryButton: {
    borderWidth: 1,
    borderColor: '#31518f',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  shareHistoryButtonText: {
    color: '#31518f',
    fontSize: 12,
    fontWeight: 'bold',
  },

  deleteHistoryButton: {
    borderWidth: 1,
    borderColor: '#c95b5b',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  deleteHistoryButtonText: {
    color: '#a22d2d',
    fontSize: 12,
    fontWeight: 'bold',
  },

  shareButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#31518f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  shareButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
