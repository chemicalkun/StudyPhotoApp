import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { LoadErrorCard } from '@/components/load-error-card';
import {
  createPracticeQuestions,
  getLectureSummaryAvailability,
  type LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import {
  loadPracticeQuestionRecords,
  savePracticeQuestionAssessment,
  savePracticeQuestionRecord,
  savePracticeQuestionSession,
  updatePracticeQuestion,
} from '@/services/practice-question-storage';
import {
  buildExamPreparationSource,
} from '@/types/exam-preparation';
import {
  createPracticeQuestionRecordId,
  createPracticeQuestionSourceSignature,
  type PracticeQuestion,
  type PracticeQuestionAssessment,
  type PracticeQuestionSession,
} from '@/types/practice-question';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';
import { shuffleIndexes } from '@/utils/random-order';
import { getUnansweredItemIndexes } from '@/utils/study-assessment';
import { buildPracticeQuestionShareMessage } from '@/utils/study-material-share';


const practiceQuestionCountOptions = [3, 5, 8] as const;
type PracticeQuestionCount =
  typeof practiceQuestionCountOptions[number];


const isPracticeQuestionCount = (
  value: number
): value is PracticeQuestionCount =>
  practiceQuestionCountOptions.some(
    (count) => count === value
  );


export default function PracticeQuestionScreen() {
  const params = useLocalSearchParams();
  const subject =
    typeof params.subject === 'string'
      ? params.subject
      : '';
  const startInReviewMode = params.mode === 'review';
  const startInUnansweredMode =
    params.mode === 'unanswered';
  const openedFromReview = params.from === 'review';

  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [questions, setQuestions] =
    useState<PracticeQuestion[]>([]);
  const [selectedQuestionCount, setSelectedQuestionCount] =
    useState<PracticeQuestionCount>(5);
  const [questionOrder, setQuestionOrder] =
    useState<number[]>([]);
  const [currentQuestionPosition, setCurrentQuestionPosition] =
    useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewRound, setIsReviewRound] = useState(false);
  const [isUnansweredRound, setIsUnansweredRound] =
    useState(false);
  const [assessments, setAssessments] = useState<
    Record<string, PracticeQuestionAssessment>
  >({});
  const [availability, setAvailability] =
    useState<LectureSummaryAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [generationError, setGenerationError] =
    useState('');
  const [saveError, setSaveError] = useState('');
  const [shareError, setShareError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isOutdated, setIsOutdated] = useState(false);
  const [isEditingCurrentQuestion, setIsEditingCurrentQuestion] =
    useState(false);
  const [isSavingCurrentQuestion, setIsSavingCurrentQuestion] =
    useState(false);
  const [questionEditError, setQuestionEditError] = useState('');
  const editedQuestionRef = useRef('');
  const editedAnswerRef = useRef('');
  const [loadRevision, setLoadRevision] = useState(0);


  useFocusEffect(
    useCallback(() => {
      void loadRevision;
      let active = true;

      const loadData = async () => {
        try {
          setLoading(true);
          setLoadError('');
          setGenerationError('');
          setSaveError('');
          setShareError('');

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
          const hasSavedRecord = savedRecord !== undefined;
          const savedRecordIsCurrent =
            savedRecord !== undefined &&
            savedRecord.sourceSummarySignature ===
              sourceSignature;

          setSummaries(subjectSummaries);
          setAvailability(modelAvailability);
          const loadedQuestions = hasSavedRecord
            ? savedRecord.questions
            : [];
          const loadedAssessments = hasSavedRecord
            ? savedRecord.assessments ?? {}
            : {};
          const reviewQuestionIndexes =
            loadedQuestions.flatMap((_, index) =>
              loadedAssessments[String(index)] === 'review'
                ? [index]
                : []
            );
          const shouldStartReviewRound =
            startInReviewMode &&
            reviewQuestionIndexes.length > 0;
          const unansweredQuestionIndexes =
            getUnansweredItemIndexes(
              loadedQuestions.length,
              loadedAssessments
            );
          const shouldStartUnansweredRound =
            startInUnansweredMode &&
            unansweredQuestionIndexes.length > 0;
          const savedSession =
            !startInReviewMode &&
            !startInUnansweredMode
              ? savedRecord?.session
              : undefined;
          const sessionIndexes = savedSession !== undefined
            ? savedSession.order
            : shouldStartReviewRound
            ? reviewQuestionIndexes
            : shouldStartUnansweredRound
              ? unansweredQuestionIndexes
              : loadedQuestions.map((_, index) => index);

          setQuestions(loadedQuestions);
          setSelectedQuestionCount(
            isPracticeQuestionCount(loadedQuestions.length)
              ? loadedQuestions.length
              : 5
          );
          setQuestionOrder(
            savedSession === undefined
              ? shuffleIndexes(sessionIndexes)
              : sessionIndexes
          );
          setIsSaved(hasSavedRecord);
          setIsOutdated(
            hasSavedRecord && !savedRecordIsCurrent
          );
          setAssessments(loadedAssessments);
          setCurrentQuestionPosition(
            savedSession?.currentPosition ?? 0
          );
          setShowAnswer(false);
          setIsFinished(savedSession?.isFinished ?? false);
          setIsReviewRound(shouldStartReviewRound);
          setIsUnansweredRound(shouldStartUnansweredRound);
          setIsEditingCurrentQuestion(false);
          setIsSavingCurrentQuestion(false);
          setQuestionEditError('');
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
    }, [
      loadRevision,
      startInReviewMode,
      startInUnansweredMode,
      subject,
    ])
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
      setShareError('');
      setIsSaved(false);
      setIsOutdated(false);

      const generatedQuestions =
        await createPracticeQuestions(
          source,
          selectedQuestionCount
        );
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

      const generatedQuestionOrder = shuffleIndexes(
        validQuestions.map((_, index) => index)
      );
      const generatedSession: PracticeQuestionSession = {
        order: generatedQuestionOrder,
        currentPosition: 0,
        isFinished: false,
      };

      setQuestions(validQuestions);
      setQuestionOrder(generatedQuestionOrder);
      setCurrentQuestionPosition(0);
      setShowAnswer(false);
      setIsFinished(false);
      setIsReviewRound(false);
      setIsUnansweredRound(false);
      setAssessments({});

      try {
        await savePracticeQuestionRecord(
          subject,
          validQuestions,
          createPracticeQuestionSourceSignature(summaries),
          generatedSession
        );
        setIsSaved(true);
        setIsOutdated(false);
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


  const shareQuestions = async () => {
    if (questions.length === 0) {
      return;
    }

    try {
      setShareError('');
      await Share.share({
        title: `${subject}の練習問題`,
        message: buildPracticeQuestionShareMessage(
          subject,
          questions
        ),
      });
    } catch (error) {
      console.log('練習問題共有エラー:', error);
      setShareError(
        '練習問題を共有できませんでした。もう一度お試しください。'
      );
    }
  };


  const persistQuestionSession = (
    session: PracticeQuestionSession
  ) => {
    if (!isSaved) {
      return;
    }

    void savePracticeQuestionSession(subject, session)
      .catch((error) => {
        console.log('練習問題の学習位置保存エラー:', error);
        setSaveError(
          '学習位置を端末に保存できませんでした。'
        );
      });
  };


  const startAllQuestionSession = () => {
    const order = shuffleIndexes(
      questions.map((_, index) => index)
    );

    setQuestionOrder(order);
    setCurrentQuestionPosition(0);
    setShowAnswer(false);
    setIsFinished(false);
    setIsReviewRound(false);
    setIsUnansweredRound(false);
    persistQuestionSession({
      order,
      currentPosition: 0,
      isFinished: false,
    });
  };


  const saveEditedQuestion = async () => {
    if (
      currentQuestionIndex === undefined ||
      isSavingCurrentQuestion
    ) {
      return;
    }

    const question = editedQuestionRef.current.trim();
    const answer = editedAnswerRef.current.trim();

    if (question === '' || answer === '') {
      setQuestionEditError(
        '問題文と解答の両方を入力してください。'
      );
      return;
    }

    try {
      setIsSavingCurrentQuestion(true);
      setQuestionEditError('');

      const editedQuestions = [...questions];
      editedQuestions[currentQuestionIndex] = {
        question,
        answer,
      };
      const updatedRecord = isSaved
        ? await updatePracticeQuestion(
            subject,
            currentQuestionIndex,
            { question, answer }
          )
        : await savePracticeQuestionRecord(
            subject,
            editedQuestions,
            createPracticeQuestionSourceSignature(summaries)
          );

      setQuestions(updatedRecord.questions);
      editedQuestionRef.current =
        updatedRecord.questions[currentQuestionIndex]?.question ??
        question;
      editedAnswerRef.current =
        updatedRecord.questions[currentQuestionIndex]?.answer ??
        answer;
      setIsEditingCurrentQuestion(false);
      setIsSaved(true);
    } catch (error) {
      console.log('練習問題編集エラー:', error);
      setQuestionEditError(
        '練習問題を保存できませんでした。もう一度お試しください。'
      );
    } finally {
      setIsSavingCurrentQuestion(false);
    }
  };


  const saveAssessment = async (
    assessment: PracticeQuestionAssessment
  ) => {
    const questionIndex =
      questionOrder[currentQuestionPosition];

    if (questionIndex === undefined) {
      return;
    }

    setAssessments((currentAssessments) => ({
      ...currentAssessments,
      [String(questionIndex)]: assessment,
    }));
    setSaveError('');

    try {
      await savePracticeQuestionAssessment(
        subject,
        questionIndex,
        assessment
      );
    } catch (error) {
      console.log('練習問題自己評価保存エラー:', error);
      setSaveError(
        '自己評価を端末に保存できませんでした。'
      );
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


  const currentQuestionIndex =
    questionOrder[currentQuestionPosition];
  const currentQuestion = currentQuestionIndex === undefined
    ? null
    : questions[currentQuestionIndex] ?? null;
  const currentAssessment =
    currentQuestionIndex === undefined
      ? undefined
      : assessments[String(currentQuestionIndex)];
  const knownCount = Object.values(assessments)
    .filter((assessment) => assessment === 'known')
    .length;
  const reviewCount = Object.values(assessments)
    .filter((assessment) => assessment === 'review')
    .length;
  const unansweredCount = Math.max(
    0,
    questions.length - knownCount - reviewCount
  );
  const reviewQuestionIndexes = questions.flatMap(
    (_, questionIndex) =>
      assessments[String(questionIndex)] === 'review'
        ? [questionIndex]
        : []
  );


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '練習問題',
          headerBackTitle: startInReviewMode ||
            startInUnansweredMode ||
            openedFromReview
            ? '復習'
            : '試験対策',
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
        <Text style={styles.title}>{subject}</Text>
        <Text style={styles.subtitle}>練習問題</Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#31518f" />
            <Text style={styles.loadingText}>読み込み中...</Text>
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
            <Text style={styles.notice}>
              {summaries.length}回分の保存済みまとめから、このiPhone内で{selectedQuestionCount}問作成します。作成後、別のAIが根拠と一般知識に照らして解答を再確認します。出題順は毎回ランダムです。
            </Text>

            <View style={styles.questionCountSection}>
              <Text style={styles.questionCountLabel}>
                作成する問題数
              </Text>
              <View style={styles.questionCountRow}>
                {practiceQuestionCountOptions.map((count) => {
                  const isSelected =
                    selectedQuestionCount === count;

                  return (
                    <Pressable
                      key={count}
                      style={[
                        styles.questionCountButton,
                        isSelected &&
                          styles.questionCountButtonSelected,
                        isGenerating && styles.disabledButton,
                      ]}
                      disabled={isGenerating}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${count}問作成`}
                      onPress={() => setSelectedQuestionCount(count)}
                    >
                      <Text
                        style={[
                          styles.questionCountButtonText,
                          isSelected &&
                            styles.questionCountButtonTextSelected,
                        ]}
                      >
                        {count}問
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

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
            {shareError !== '' ? (
              <Text style={styles.errorText}>{shareError}</Text>
            ) : null}

            {isOutdated ? (
              <Text style={styles.outdatedNotice}>
                授業まとめが更新されています。この練習問題は更新前のまとめから作成されたものです。必要に応じて「練習問題を作り直す」を押してください。
              </Text>
            ) : null}

            {questions.length > 0 ? (
              <Pressable
                style={styles.shareButton}
                accessibilityRole="button"
                accessibilityLabel={`${subject}の練習問題をまとめて共有`}
                onPress={() => void shareQuestions()}
              >
                <Text style={styles.shareButtonText}>
                  練習問題をまとめて共有
                </Text>
              </Pressable>
            ) : null}

            {isFinished && questions.length > 0 ? (
              <View style={styles.completionCard}>
                <Text style={styles.completionTitle}>
                  練習終了
                </Text>

                <Text style={styles.completionText}>
                  覚えた {knownCount}問
                </Text>
                <Text style={styles.completionText}>
                  あとで復習 {reviewCount}問
                </Text>
                <Text style={styles.completionText}>
                  未評価 {unansweredCount}問
                </Text>

                {reviewQuestionIndexes.length > 0 ? (
                  <Pressable
                    style={styles.retryReviewButton}
                    onPress={() => {
                      setQuestionOrder(
                        shuffleIndexes(reviewQuestionIndexes)
                      );
                      setCurrentQuestionPosition(0);
                      setShowAnswer(false);
                      setIsFinished(false);
                      setIsReviewRound(true);
                      setIsUnansweredRound(false);
                    }}
                  >
                    <Text style={styles.retryReviewButtonText}>
                      あとで復習だけ解き直す
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.retryAllButton}
                  onPress={startAllQuestionSession}
                >
                  <Text style={styles.retryAllButtonText}>
                    すべての問題を見直す
                  </Text>
                </Pressable>
              </View>
            ) : currentQuestion !== null ? (
              <View style={styles.questionSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {isReviewRound
                      ? '復習 '
                      : isUnansweredRound
                        ? '未回答 '
                        : '問題 '}
                    {currentQuestionPosition + 1} /{' '}
                    {questionOrder.length}
                  </Text>
                  {isSaved ? (
                    <Text style={styles.savedText}>端末に保存済み</Text>
                  ) : null}
                </View>

                <Text style={styles.assessmentSummary}>
                  覚えた {knownCount}問・あとで復習 {reviewCount}問
                </Text>

                {isEditingCurrentQuestion ? (
                  <View style={styles.editCard}>
                    <Text style={styles.editLabel}>問題文</Text>
                    <TextInput
                      style={styles.questionEditInput}
                      defaultValue={editedQuestionRef.current}
                      onChangeText={(text) => {
                        editedQuestionRef.current = text;
                        setQuestionEditError('');
                      }}
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                      editable={!isSavingCurrentQuestion}
                      accessibilityLabel="練習問題の問題文"
                    />

                    <Text style={styles.editLabel}>解答</Text>
                    <TextInput
                      style={styles.answerEditInput}
                      defaultValue={editedAnswerRef.current}
                      onChangeText={(text) => {
                        editedAnswerRef.current = text;
                        setQuestionEditError('');
                      }}
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                      editable={!isSavingCurrentQuestion}
                      accessibilityLabel="練習問題の解答"
                    />

                    {questionEditError !== '' ? (
                      <Text style={styles.editErrorText}>
                        {questionEditError}
                      </Text>
                    ) : null}

                    <View style={styles.editActions}>
                      <Pressable
                        style={[
                          styles.saveEditButton,
                          isSavingCurrentQuestion &&
                            styles.disabledButton,
                        ]}
                        disabled={isSavingCurrentQuestion}
                        onPress={() => void saveEditedQuestion()}
                      >
                        {isSavingCurrentQuestion ? (
                          <ActivityIndicator
                            size="small"
                            color="white"
                          />
                        ) : null}
                        <Text style={styles.saveEditButtonText}>
                          {isSavingCurrentQuestion
                            ? '保存中...'
                            : '変更を保存'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.cancelEditButton}
                        disabled={isSavingCurrentQuestion}
                        onPress={() => {
                          editedQuestionRef.current =
                            currentQuestion.question;
                          editedAnswerRef.current =
                            currentQuestion.answer;
                          setQuestionEditError('');
                          setIsEditingCurrentQuestion(false);
                        }}
                      >
                        <Text style={styles.cancelEditButtonText}>
                          キャンセル
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                <View style={styles.questionCard}>
                  <Text style={styles.questionLabel}>問題</Text>
                  <Text style={styles.questionText} selectable>
                    {currentQuestion.question}
                  </Text>

                  {showAnswer ? (
                    <>
                      <View style={styles.answerBox}>
                        <Text style={styles.answerLabel}>答え</Text>
                        <Text style={styles.answerText} selectable>
                          {currentQuestion.answer}
                        </Text>
                      </View>

                      <Pressable
                        style={styles.editButton}
                        accessibilityRole="button"
                        accessibilityLabel="この練習問題を編集"
                        onPress={() => {
                          editedQuestionRef.current =
                            currentQuestion.question;
                          editedAnswerRef.current =
                            currentQuestion.answer;
                          setQuestionEditError('');
                          setIsEditingCurrentQuestion(true);
                        }}
                      >
                        <Text style={styles.editButtonText}>
                          この問題を編集
                        </Text>
                      </Pressable>

                      <Text style={styles.assessmentPrompt}>
                        この問題を覚えましたか？
                      </Text>

                      <View style={styles.assessmentRow}>
                        <Pressable
                          style={[
                            styles.reviewButton,
                            currentAssessment === 'review' &&
                              styles.reviewButtonSelected,
                          ]}
                          onPress={() =>
                            void saveAssessment('review')
                          }
                        >
                          <Text style={styles.reviewButtonText}>
                            あとで復習
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.knownButton,
                            currentAssessment === 'known' &&
                              styles.knownButtonSelected,
                          ]}
                          onPress={() =>
                            void saveAssessment('known')
                          }
                        >
                          <Text style={styles.knownButtonText}>
                            覚えた
                          </Text>
                        </Pressable>
                      </View>
                    </>
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
                )}

                {!isEditingCurrentQuestion ? (
                <View style={styles.navigationRow}>
                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentQuestionPosition === 0 &&
                        styles.disabledButton,
                    ]}
                    disabled={currentQuestionPosition === 0}
                    onPress={() => {
                      const nextPosition =
                        currentQuestionPosition - 1;

                      setCurrentQuestionPosition(
                        nextPosition
                      );
                      setShowAnswer(false);

                      if (
                        !isReviewRound &&
                        !isUnansweredRound
                      ) {
                        persistQuestionSession({
                          order: questionOrder,
                          currentPosition: nextPosition,
                          isFinished: false,
                        });
                      }
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      前の問題
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.navigationButton}
                    onPress={() => {
                      if (
                        currentQuestionPosition ===
                        questionOrder.length - 1
                      ) {
                        setIsFinished(true);
                        setShowAnswer(false);

                        if (
                          !isReviewRound &&
                          !isUnansweredRound
                        ) {
                          persistQuestionSession({
                            order: questionOrder,
                            currentPosition:
                              currentQuestionPosition,
                            isFinished: true,
                          });
                        }

                        return;
                      }

                      const nextPosition =
                        currentQuestionPosition + 1;

                      setCurrentQuestionPosition(
                        nextPosition
                      );
                      setShowAnswer(false);

                      if (
                        !isReviewRound &&
                        !isUnansweredRound
                      ) {
                        persistQuestionSession({
                          order: questionOrder,
                          currentPosition: nextPosition,
                          isFinished: false,
                        });
                      }
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      {currentQuestionPosition ===
                      questionOrder.length - 1
                        ? '終了する'
                        : '次の問題'}
                    </Text>
                  </Pressable>
                </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  keyboardAvoidingView: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 48 },
  title: { color: '#111', fontSize: 30, fontWeight: 'bold', marginTop: 24 },
  subtitle: { color: '#555', fontSize: 17, marginTop: 6, marginBottom: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  loadingText: { color: '#555', fontSize: 14 },
  notice: { color: '#555', backgroundColor: '#f3f6ff', borderRadius: 10, fontSize: 13, lineHeight: 20, padding: 13 },
  questionCountSection: { marginTop: 14 },
  questionCountLabel: { color: '#263e70', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  questionCountRow: { flexDirection: 'row', gap: 8 },
  questionCountButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#8fa7d9', borderRadius: 9, paddingVertical: 10 },
  questionCountButtonSelected: { backgroundColor: '#31518f', borderColor: '#31518f' },
  questionCountButtonText: { color: '#31518f', fontSize: 14, fontWeight: 'bold' },
  questionCountButtonTextSelected: { color: 'white' },
  generateButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#31518f', borderRadius: 10, padding: 14, marginTop: 14 },
  generateButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  disabledButton: { opacity: 0.45 },
  unavailableText: { color: '#725b24', backgroundColor: '#fff3d6', borderRadius: 8, fontSize: 13, lineHeight: 20, padding: 12, marginTop: 14 },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, marginTop: 12 },
  outdatedNotice: { color: '#725b24', backgroundColor: '#fff3d6', borderRadius: 8, fontSize: 12, lineHeight: 19, padding: 10, marginTop: 12 },
  shareButton: { alignItems: 'center', borderWidth: 1, borderColor: '#31518f', borderRadius: 9, padding: 12, marginTop: 12 },
  shareButtonText: { color: '#31518f', fontSize: 14, fontWeight: 'bold' },
  completionCard: { backgroundColor: '#f3f6ff', borderWidth: 1, borderColor: '#aebee6', borderRadius: 14, padding: 20, marginTop: 22 },
  completionTitle: { color: '#31518f', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  completionText: { color: '#333', fontSize: 15, lineHeight: 25, textAlign: 'center' },
  retryReviewButton: { backgroundColor: '#b57c13', borderRadius: 9, padding: 13, marginTop: 18 },
  retryReviewButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  retryAllButton: { backgroundColor: '#31518f', borderRadius: 9, padding: 13, marginTop: 10 },
  retryAllButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  questionSection: { marginTop: 22 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { color: '#333', fontSize: 14, fontWeight: 'bold' },
  savedText: { color: '#28794c', fontSize: 11 },
  assessmentSummary: { color: '#666', fontSize: 12, marginTop: 6 },
  questionCard: { backgroundColor: '#eef8f2', borderWidth: 1, borderColor: '#9bc9aa', borderRadius: 14, padding: 18, marginTop: 10 },
  questionLabel: { color: '#28794c', fontSize: 13, fontWeight: 'bold' },
  questionText: { color: '#1d1d1d', fontSize: 18, fontWeight: 'bold', lineHeight: 28, marginTop: 8 },
  answerButton: { backgroundColor: '#28794c', borderRadius: 9, padding: 12, marginTop: 20 },
  answerButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  answerBox: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginTop: 18 },
  answerLabel: { color: '#28794c', fontSize: 13, fontWeight: 'bold' },
  answerText: { color: '#222', fontSize: 15, lineHeight: 23, marginTop: 6 },
  editButton: { alignSelf: 'center', borderWidth: 1, borderColor: '#28794c', borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  editButtonText: { color: '#28794c', fontSize: 14, fontWeight: 'bold' },
  editCard: { backgroundColor: '#eef8f2', borderWidth: 1, borderColor: '#9bc9aa', borderRadius: 14, padding: 16, marginTop: 10 },
  editLabel: { color: '#28794c', fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  questionEditInput: { height: 130, color: '#1d1d1d', backgroundColor: 'white', borderWidth: 1, borderColor: '#9bc9aa', borderRadius: 9, fontSize: 16, lineHeight: 24, padding: 12, marginBottom: 14 },
  answerEditInput: { height: 190, color: '#1d1d1d', backgroundColor: 'white', borderWidth: 1, borderColor: '#9bc9aa', borderRadius: 9, fontSize: 16, lineHeight: 24, padding: 12 },
  editErrorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, marginTop: 10 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  saveEditButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#28794c', borderRadius: 9, padding: 12 },
  saveEditButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  cancelEditButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#71947d', borderRadius: 9, padding: 12 },
  cancelEditButtonText: { color: '#285c3b', fontSize: 14, fontWeight: 'bold' },
  assessmentPrompt: { color: '#444', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 16 },
  assessmentRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  reviewButton: { flex: 1, backgroundColor: '#fff3d6', borderWidth: 1, borderColor: '#dfbd6d', borderRadius: 9, padding: 11 },
  reviewButtonSelected: { backgroundColor: '#f3cf78', borderColor: '#a77916' },
  reviewButtonText: { color: '#725b24', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  knownButton: { flex: 1, backgroundColor: '#e3f4e9', borderWidth: 1, borderColor: '#94c5a5', borderRadius: 9, padding: 11 },
  knownButtonSelected: { backgroundColor: '#a9ddb9', borderColor: '#28794c' },
  knownButtonText: { color: '#28794c', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  navigationRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navigationButton: { flex: 1, backgroundColor: '#333', borderRadius: 9, padding: 12 },
  navigationButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
