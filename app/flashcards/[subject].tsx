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
  createFlashcards,
  getLectureSummaryAvailability,
  type LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import {
  loadFlashcardRecords,
  saveFlashcardAssessment,
  saveFlashcardRecord,
  saveFlashcardSession,
  updateFlashcard,
} from '@/services/flashcard-storage';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import { buildExamPreparationSource } from '@/types/exam-preparation';
import {
  createFlashcardRecordId,
  createFlashcardSourceSignature,
  type Flashcard,
  type FlashcardAssessment,
  type FlashcardSession,
} from '@/types/flashcard';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';
import {
  createFlashcardSession,
  flashcardRoundSize,
  takeNextFlashcardRound,
} from '@/utils/flashcard-session';
import { getUnansweredItemIndexes } from '@/utils/study-assessment';
import { buildFlashcardShareMessage } from '@/utils/study-material-share';


const flashcardCountOptions = [5, 8, 12] as const;
type FlashcardCount = typeof flashcardCountOptions[number];


const isFlashcardCount = (
  value: number
): value is FlashcardCount =>
  flashcardCountOptions.some((count) => count === value);


export default function FlashcardScreen() {
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
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [selectedCardCount, setSelectedCardCount] =
    useState<FlashcardCount>(8);
  const [cardOrder, setCardOrder] = useState<number[]>([]);
  const [remainingCardOrder, setRemainingCardOrder] =
    useState<number[]>([]);
  const [currentRoundNumber, setCurrentRoundNumber] =
    useState(1);
  const [totalRoundCount, setTotalRoundCount] = useState(0);
  const [currentCardPosition, setCurrentCardPosition] =
    useState(0);
  const [showDefinition, setShowDefinition] =
    useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewRound, setIsReviewRound] = useState(false);
  const [isUnansweredRound, setIsUnansweredRound] =
    useState(false);
  const [assessments, setAssessments] = useState<
    Record<string, FlashcardAssessment>
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
  const [isEditingCurrentCard, setIsEditingCurrentCard] =
    useState(false);
  const [isSavingCurrentCard, setIsSavingCurrentCard] =
    useState(false);
  const [cardEditError, setCardEditError] = useState('');
  const editedTermRef = useRef('');
  const editedDefinitionRef = useRef('');
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
            flashcardRecords,
          ] = await Promise.all([
            loadLectureSummaryRecords(),
            getLectureSummaryAvailability(),
            loadFlashcardRecords(),
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
          const savedRecord = flashcardRecords[
            createFlashcardRecordId(subject)
          ];
          const hasSavedRecord = savedRecord !== undefined;
          const savedRecordIsCurrent =
            savedRecord !== undefined &&
            savedRecord.sourceSummarySignature ===
              createFlashcardSourceSignature(
                subjectSummaries
              );

          setSummaries(subjectSummaries);
          setAvailability(modelAvailability);
          const loadedCards = hasSavedRecord
            ? savedRecord.cards
            : [];
          const loadedAssessments = hasSavedRecord
            ? savedRecord.assessments ?? {}
            : {};
          const reviewCardIndexes = loadedCards.flatMap(
            (_, index) =>
              loadedAssessments[String(index)] === 'review'
                ? [index]
                : []
          );
          const shouldStartReviewRound =
            startInReviewMode &&
            reviewCardIndexes.length > 0;
          const unansweredCardIndexes =
            getUnansweredItemIndexes(
              loadedCards.length,
              loadedAssessments
            );
          const shouldStartUnansweredRound =
            startInUnansweredMode &&
            unansweredCardIndexes.length > 0;
          const sessionIndexes = shouldStartReviewRound
            ? reviewCardIndexes
            : shouldStartUnansweredRound
              ? unansweredCardIndexes
              : loadedCards.map((_, index) => index);
          const savedSession =
            !startInReviewMode &&
            !startInUnansweredMode
              ? savedRecord?.session
              : undefined;
          const newSession = savedSession === undefined
            ? createFlashcardSession(sessionIndexes)
            : null;

          setCards(loadedCards);
          setSelectedCardCount(
            isFlashcardCount(loadedCards.length)
              ? loadedCards.length
              : 8
          );
          setCardOrder(
            savedSession?.currentRound ??
              newSession?.currentRound ??
              []
          );
          setRemainingCardOrder(
            savedSession?.remaining ??
              newSession?.remaining ??
              []
          );
          setCurrentRoundNumber(
            savedSession?.currentRoundNumber ?? 1
          );
          setTotalRoundCount(
            savedSession?.totalRoundCount ??
              newSession?.totalRounds ??
              0
          );
          setAssessments(loadedAssessments);
          setIsSaved(hasSavedRecord);
          setIsOutdated(
            hasSavedRecord && !savedRecordIsCurrent
          );
          setCurrentCardPosition(
            savedSession?.currentPosition ?? 0
          );
          setShowDefinition(false);
          setIsFinished(savedSession?.isFinished ?? false);
          setIsReviewRound(shouldStartReviewRound);
          setIsUnansweredRound(shouldStartUnansweredRound);
          setIsEditingCurrentCard(false);
          setIsSavingCurrentCard(false);
          setCardEditError('');
        } catch (error) {
          console.log('フラッシュカード読み込みエラー:', error);

          if (active) {
            setLoadError(
              '授業まとめまたはフラッシュカードを読み込めませんでした。'
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


  const generateFlashcards = async () => {
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
        'カードに使える授業まとめがありません。'
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

      const generatedCards = await createFlashcards(
        source,
        selectedCardCount
      );
      const validCards = generatedCards
        .map((card) => ({
          term: card.term.trim(),
          definition: card.definition.trim(),
        }))
        .filter(
          (card) =>
            card.term !== '' && card.definition !== ''
        );

      if (validCards.length === 0) {
        throw new Error('生成されたカードが空です');
      }

      const session = createFlashcardSession(
        validCards.map((_, index) => index)
      );
      const savedSession: FlashcardSession = {
        currentRound: session.currentRound,
        remaining: session.remaining,
        currentPosition: 0,
        currentRoundNumber: 1,
        totalRoundCount: session.totalRounds,
        isFinished: false,
      };

      setCards(validCards);
      setCardOrder(session.currentRound);
      setRemainingCardOrder(session.remaining);
      setCurrentRoundNumber(1);
      setTotalRoundCount(session.totalRounds);
      setCurrentCardPosition(0);
      setShowDefinition(false);
      setIsFinished(false);
      setIsReviewRound(false);
      setIsUnansweredRound(false);
      setAssessments({});

      try {
        await saveFlashcardRecord(
          subject,
          validCards,
          createFlashcardSourceSignature(summaries),
          savedSession
        );
        setIsSaved(true);
        setIsOutdated(false);
      } catch (storageError) {
        console.log('フラッシュカード保存エラー:', storageError);
        setSaveError(
          'カードは表示できますが、端末に保存できませんでした。'
        );
      }
    } catch (error) {
      console.log('フラッシュカード作成エラー:', error);
      setGenerationError(
        'フラッシュカードを作成できませんでした。少し待ってから再試行してください。'
      );
    } finally {
      setIsGenerating(false);
    }
  };


  const shareCards = async () => {
    if (cards.length === 0) {
      return;
    }

    try {
      setShareError('');
      await Share.share({
        title: `${subject}のフラッシュカード`,
        message: buildFlashcardShareMessage(subject, cards),
      });
    } catch (error) {
      console.log('フラッシュカード共有エラー:', error);
      setShareError(
        'フラッシュカードを共有できませんでした。もう一度お試しください。'
      );
    }
  };


  const persistFlashcardSession = (
    session: FlashcardSession
  ) => {
    if (!isSaved) {
      return;
    }

    void saveFlashcardSession(subject, session)
      .catch((error) => {
        console.log(
          'フラッシュカードの学習位置保存エラー:',
          error
        );
        setSaveError(
          '学習位置を端末に保存できませんでした。'
        );
      });
  };


  const startCardSession = (
    indexes: number[],
    mode: 'all' | 'review' | 'unanswered'
  ) => {
    const session = createFlashcardSession(indexes);

    setCardOrder(session.currentRound);
    setRemainingCardOrder(session.remaining);
    setCurrentRoundNumber(1);
    setTotalRoundCount(session.totalRounds);
    setCurrentCardPosition(0);
    setShowDefinition(false);
    setIsFinished(false);
    setIsReviewRound(mode === 'review');
    setIsUnansweredRound(mode === 'unanswered');
    setIsEditingCurrentCard(false);
    setCardEditError('');

    if (mode === 'all') {
      persistFlashcardSession({
        currentRound: session.currentRound,
        remaining: session.remaining,
        currentPosition: 0,
        currentRoundNumber: 1,
        totalRoundCount: session.totalRounds,
        isFinished: false,
      });
    }
  };


  const startNextRound = () => {
    const nextRound = takeNextFlashcardRound(
      remainingCardOrder
    );
    const nextRoundNumber = currentRoundNumber + 1;

    setCardOrder(nextRound.currentRound);
    setRemainingCardOrder(nextRound.remaining);
    setCurrentRoundNumber(nextRoundNumber);
    setCurrentCardPosition(0);
    setShowDefinition(false);
    setIsFinished(false);
    setIsEditingCurrentCard(false);
    setCardEditError('');

    if (!isReviewRound && !isUnansweredRound) {
      persistFlashcardSession({
        currentRound: nextRound.currentRound,
        remaining: nextRound.remaining,
        currentPosition: 0,
        currentRoundNumber: nextRoundNumber,
        totalRoundCount,
        isFinished: false,
      });
    }
  };


  const saveEditedCard = async () => {
    if (
      currentCardIndex === undefined ||
      isSavingCurrentCard
    ) {
      return;
    }

    const term = editedTermRef.current.trim();
    const definition = editedDefinitionRef.current.trim();

    if (term === '' || definition === '') {
      setCardEditError('重要語句と説明の両方を入力してください。');
      return;
    }

    try {
      setIsSavingCurrentCard(true);
      setCardEditError('');

      const editedCards = [...cards];
      editedCards[currentCardIndex] = { term, definition };
      const updatedRecord = isSaved
        ? await updateFlashcard(
            subject,
            currentCardIndex,
            { term, definition }
          )
        : await saveFlashcardRecord(
            subject,
            editedCards,
            createFlashcardSourceSignature(summaries)
          );

      setCards(updatedRecord.cards);
      editedTermRef.current =
        updatedRecord.cards[currentCardIndex]?.term ?? term;
      editedDefinitionRef.current =
        updatedRecord.cards[currentCardIndex]?.definition ??
        definition;
      setIsEditingCurrentCard(false);
      setIsSaved(true);
    } catch (error) {
      console.log('フラッシュカード編集エラー:', error);
      setCardEditError(
        'カードを保存できませんでした。もう一度お試しください。'
      );
    } finally {
      setIsSavingCurrentCard(false);
    }
  };


  const saveAssessment = async (
    assessment: FlashcardAssessment
  ) => {
    const cardIndex = cardOrder[currentCardPosition];

    if (currentCard === null || cardIndex === undefined) {
      return;
    }

    setAssessments((currentAssessments) => ({
      ...currentAssessments,
      [String(cardIndex)]: assessment,
    }));
    setSaveError('');

    try {
      await saveFlashcardAssessment(
        subject,
        cardIndex,
        assessment
      );
    } catch (error) {
      console.log('フラッシュカード自己評価保存エラー:', error);
      setSaveError(
        '自己評価を端末に保存できませんでした。'
      );
    }
  };


  const getUnavailableMessage = () => {
    switch (availability) {
      case 'unsupportedBuild':
        return 'フラッシュカード機能を利用するには、開発ビルドの再インストールが必要です。';
      case 'unsupportedOS':
        return '端末内AIフラッシュカードにはiOS 26以降が必要です。';
      case 'deviceNotEligible':
        return 'この端末はApple Intelligenceに対応していません。';
      case 'appleIntelligenceNotEnabled':
        return 'iPhoneの設定でApple Intelligenceを有効にしてください。';
      case 'modelNotReady':
        return 'Apple Intelligenceのモデルを準備中です。しばらく待ってから再試行してください。';
      case 'unknown':
        return '端末内AIフラッシュカードを現在利用できません。';
      default:
        return '';
    }
  };


  const currentCardIndex = cardOrder[currentCardPosition];
  const currentCard = currentCardIndex === undefined
    ? null
    : cards[currentCardIndex] ?? null;
  const currentAssessment = currentCardIndex === undefined
    ? undefined
    : assessments[String(currentCardIndex)];
  const knownCount = Object.values(assessments)
    .filter((assessment) => assessment === 'known')
    .length;
  const reviewCount = Object.values(assessments)
    .filter((assessment) => assessment === 'review')
    .length;
  const unansweredCount = Math.max(
    0,
    cards.length - knownCount - reviewCount
  );
  const reviewCardIndexes = cards.flatMap(
    (_, cardIndex) =>
      assessments[String(cardIndex)] === 'review'
        ? [cardIndex]
        : []
  );


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'フラッシュカード',
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
        <Text style={styles.subtitle}>フラッシュカード</Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#6b3ca0" />
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
              {summaries.length}回分のまとめから重要語句を{selectedCardCount}枚作成し、別のAIが説明を再確認します。カードは順番を毎回ランダムにし、5枚ずつ表示します。
            </Text>

            <View style={styles.cardCountSection}>
              <Text style={styles.cardCountLabel}>
                作成する枚数
              </Text>
              <View style={styles.cardCountRow}>
                {flashcardCountOptions.map((count) => {
                  const isSelected = selectedCardCount === count;

                  return (
                    <Pressable
                      key={count}
                      style={[
                        styles.cardCountButton,
                        isSelected && styles.cardCountButtonSelected,
                        isGenerating && styles.disabledButton,
                      ]}
                      disabled={isGenerating}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${count}枚作成`}
                      onPress={() => setSelectedCardCount(count)}
                    >
                      <Text
                        style={[
                          styles.cardCountButtonText,
                          isSelected &&
                            styles.cardCountButtonTextSelected,
                        ]}
                      >
                        {count}枚
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
                onPress={() => void generateFlashcards()}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" />
                ) : null}
                <Text style={styles.generateButtonText}>
                  {isGenerating
                    ? 'カードを作成・確認中...'
                    : cards.length === 0
                      ? 'フラッシュカードを作成'
                      : 'フラッシュカードを作り直す'}
                </Text>
              </Pressable>
            ) : availability === null ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#6b3ca0" />
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
                授業まとめが更新されています。このフラッシュカードは更新前のまとめから作成されたものです。必要に応じて「フラッシュカードを作り直す」を押してください。
              </Text>
            ) : null}

            {cards.length > 0 ? (
              <Pressable
                style={styles.shareButton}
                accessibilityRole="button"
                accessibilityLabel={`${subject}のフラッシュカードをまとめて共有`}
                onPress={() => void shareCards()}
              >
                <Text style={styles.shareButtonText}>
                  カードをまとめて共有
                </Text>
              </Pressable>
            ) : null}

            {isFinished && cards.length > 0 ? (
              <View style={styles.completionCard}>
                <Text style={styles.completionTitle}>
                  {remainingCardOrder.length > 0
                    ? `セット${currentRoundNumber}が終了しました`
                    : '学習を終了しました'}
                </Text>
                <Text style={styles.completionText}>
                  {totalRoundCount > 1
                    ? `${currentRoundNumber} / ${totalRoundCount}セット\n`
                    : ''}
                  覚えた {knownCount}枚
                  {'\n'}あとで復習 {reviewCount}枚
                  {'\n'}未評価 {unansweredCount}枚
                </Text>

                {remainingCardOrder.length > 0 ? (
                  <Pressable
                    style={styles.nextRoundButton}
                    onPress={startNextRound}
                  >
                    <Text style={styles.nextRoundButtonText}>
                      次のセットへ（
                      {Math.min(
                        flashcardRoundSize,
                        remainingCardOrder.length
                      )}枚）
                    </Text>
                  </Pressable>
                ) : null}

                {remainingCardOrder.length === 0 &&
                reviewCardIndexes.length > 0 ? (
                  <Pressable
                    style={styles.retryReviewButton}
                    onPress={() => {
                      startCardSession(
                        reviewCardIndexes,
                        'review'
                      );
                    }}
                  >
                    <Text style={styles.retryReviewButtonText}>
                      あとで復習だけ見返す
                    </Text>
                  </Pressable>
                ) : null}

                {remainingCardOrder.length === 0 ? (
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => {
                      startCardSession(
                        cards.map((_, index) => index),
                        'all'
                      );
                    }}
                  >
                    <Text style={styles.retryButtonText}>
                      すべてのカードを見直す
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : currentCard !== null ? (
              <View style={styles.cardSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {isReviewRound
                      ? '復習 '
                      : isUnansweredRound
                        ? '未回答 '
                        : 'カード '}
                    {currentCardPosition + 1} / {cardOrder.length}
                    {totalRoundCount > 1
                      ? `（セット${currentRoundNumber}/${totalRoundCount}）`
                      : ''}
                  </Text>
                  {isSaved ? (
                    <Text style={styles.savedText}>端末に保存済み</Text>
                  ) : null}
                </View>

                <Text style={styles.assessmentSummary}>
                  覚えた {knownCount}枚・あとで復習 {reviewCount}枚
                </Text>

                {isEditingCurrentCard ? (
                  <View style={styles.editCard}>
                    <Text style={styles.editLabel}>重要語句</Text>
                    <TextInput
                      style={styles.termInput}
                      defaultValue={editedTermRef.current}
                      onChangeText={(text) => {
                        editedTermRef.current = text;
                        setCardEditError('');
                      }}
                      editable={!isSavingCurrentCard}
                      returnKeyType="next"
                      accessibilityLabel="フラッシュカードの重要語句"
                    />

                    <Text style={styles.editLabel}>説明</Text>
                    <TextInput
                      style={styles.definitionInput}
                      defaultValue={editedDefinitionRef.current}
                      onChangeText={(text) => {
                        editedDefinitionRef.current = text;
                        setCardEditError('');
                      }}
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                      editable={!isSavingCurrentCard}
                      accessibilityLabel="フラッシュカードの説明"
                    />

                    {cardEditError !== '' ? (
                      <Text style={styles.editErrorText}>
                        {cardEditError}
                      </Text>
                    ) : null}

                    <View style={styles.editActions}>
                      <Pressable
                        style={[
                          styles.saveEditButton,
                          isSavingCurrentCard &&
                            styles.disabledButton,
                        ]}
                        disabled={isSavingCurrentCard}
                        onPress={() => void saveEditedCard()}
                      >
                        {isSavingCurrentCard ? (
                          <ActivityIndicator
                            size="small"
                            color="white"
                          />
                        ) : null}
                        <Text style={styles.saveEditButtonText}>
                          {isSavingCurrentCard
                            ? '保存中...'
                            : '変更を保存'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.cancelEditButton}
                        disabled={isSavingCurrentCard}
                        onPress={() => {
                          editedTermRef.current = currentCard.term;
                          editedDefinitionRef.current =
                            currentCard.definition;
                          setCardEditError('');
                          setIsEditingCurrentCard(false);
                        }}
                      >
                        <Text style={styles.cancelEditButtonText}>
                          キャンセル
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={[
                        styles.card,
                        showDefinition && styles.cardBack,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showDefinition
                          ? 'カードの表面を見る'
                          : 'カードの裏面を見る'
                      }
                      onPress={() =>
                        setShowDefinition((value) => !value)
                      }
                    >
                      <Text style={styles.cardSideLabel}>
                        {showDefinition ? '説明' : '重要語句'}
                      </Text>
                      <Text style={styles.cardText} selectable>
                        {showDefinition
                          ? currentCard.definition
                          : currentCard.term}
                      </Text>
                      <Text style={styles.flipHint}>
                        タップして{showDefinition ? '語句' : '説明'}を見る
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.editButton}
                      accessibilityRole="button"
                      accessibilityLabel="このフラッシュカードを編集"
                      onPress={() => {
                        editedTermRef.current = currentCard.term;
                        editedDefinitionRef.current =
                          currentCard.definition;
                        setCardEditError('');
                        setIsEditingCurrentCard(true);
                      }}
                    >
                      <Text style={styles.editButtonText}>
                        このカードを編集
                      </Text>
                    </Pressable>
                  </>
                )}

                {!isEditingCurrentCard && showDefinition ? (
                  <>
                    <Text style={styles.assessmentPrompt}>
                      このカードを覚えましたか？
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
                ) : null}

                {!isEditingCurrentCard ? (
                <View style={styles.navigationRow}>
                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentCardPosition === 0 &&
                        styles.disabledButton,
                    ]}
                    disabled={currentCardPosition === 0}
                    onPress={() => {
                      const nextPosition =
                        currentCardPosition - 1;

                      setCurrentCardPosition(
                        nextPosition
                      );
                      setShowDefinition(false);

                      if (
                        !isReviewRound &&
                        !isUnansweredRound
                      ) {
                        persistFlashcardSession({
                          currentRound: cardOrder,
                          remaining: remainingCardOrder,
                          currentPosition: nextPosition,
                          currentRoundNumber,
                          totalRoundCount,
                          isFinished: false,
                        });
                      }
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      前のカード
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.navigationButton}
                    onPress={() => {
                      if (
                        currentCardPosition === cardOrder.length - 1
                      ) {
                        setIsFinished(true);
                        setShowDefinition(false);

                        if (
                          !isReviewRound &&
                          !isUnansweredRound
                        ) {
                          persistFlashcardSession({
                            currentRound: cardOrder,
                            remaining: remainingCardOrder,
                            currentPosition:
                              currentCardPosition,
                            currentRoundNumber,
                            totalRoundCount,
                            isFinished: true,
                          });
                        }

                        return;
                      }

                      const nextPosition =
                        currentCardPosition + 1;

                      setCurrentCardPosition(
                        nextPosition
                      );
                      setShowDefinition(false);

                      if (
                        !isReviewRound &&
                        !isUnansweredRound
                      ) {
                        persistFlashcardSession({
                          currentRound: cardOrder,
                          remaining: remainingCardOrder,
                          currentPosition: nextPosition,
                          currentRoundNumber,
                          totalRoundCount,
                          isFinished: false,
                        });
                      }
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      {currentCardPosition === cardOrder.length - 1
                        ? '終了する'
                        : '次のカード'}
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
  notice: { color: '#555', backgroundColor: '#f5effb', borderRadius: 10, fontSize: 13, lineHeight: 20, padding: 13 },
  cardCountSection: { marginTop: 14 },
  cardCountLabel: { color: '#4b315f', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  cardCountRow: { flexDirection: 'row', gap: 8 },
  cardCountButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#b798d5', borderRadius: 9, paddingVertical: 10 },
  cardCountButtonSelected: { backgroundColor: '#6b3ca0', borderColor: '#6b3ca0' },
  cardCountButtonText: { color: '#6b3ca0', fontSize: 14, fontWeight: 'bold' },
  cardCountButtonTextSelected: { color: 'white' },
  generateButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#6b3ca0', borderRadius: 10, padding: 14, marginTop: 14 },
  generateButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  disabledButton: { opacity: 0.45 },
  unavailableText: { color: '#725b24', backgroundColor: '#fff3d6', borderRadius: 8, fontSize: 13, lineHeight: 20, padding: 12, marginTop: 14 },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, marginTop: 12 },
  outdatedNotice: { color: '#725b24', backgroundColor: '#fff3d6', borderRadius: 8, fontSize: 12, lineHeight: 19, padding: 10, marginTop: 12 },
  shareButton: { alignItems: 'center', borderWidth: 1, borderColor: '#6b3ca0', borderRadius: 9, padding: 12, marginTop: 12 },
  shareButtonText: { color: '#6b3ca0', fontSize: 14, fontWeight: 'bold' },
  completionCard: { backgroundColor: '#f5effb', borderWidth: 1, borderColor: '#b798d5', borderRadius: 14, padding: 20, marginTop: 22 },
  completionTitle: { color: '#6b3ca0', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  completionText: { color: '#333', fontSize: 15, lineHeight: 25, textAlign: 'center' },
  nextRoundButton: { backgroundColor: '#6b3ca0', borderRadius: 9, padding: 13, marginTop: 18 },
  nextRoundButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  retryReviewButton: { backgroundColor: '#b57c13', borderRadius: 9, padding: 13, marginTop: 18 },
  retryReviewButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  retryButton: { backgroundColor: '#6b3ca0', borderRadius: 9, padding: 13, marginTop: 10 },
  retryButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  cardSection: { marginTop: 22 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { color: '#333', fontSize: 14, fontWeight: 'bold' },
  savedText: { color: '#6b3ca0', fontSize: 11 },
  assessmentSummary: { color: '#666', fontSize: 12, marginTop: 6 },
  card: { minHeight: 280, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5effb', borderWidth: 2, borderColor: '#b798d5', borderRadius: 18, padding: 24, marginTop: 12 },
  cardBack: { backgroundColor: '#eee4f7' },
  cardSideLabel: { color: '#6b3ca0', fontSize: 13, fontWeight: 'bold' },
  cardText: { color: '#251832', fontSize: 22, fontWeight: 'bold', lineHeight: 32, textAlign: 'center', marginTop: 14 },
  flipHint: { color: '#755f88', fontSize: 12, marginTop: 24 },
  editButton: { alignSelf: 'center', borderWidth: 1, borderColor: '#6b3ca0', borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  editButtonText: { color: '#6b3ca0', fontSize: 14, fontWeight: 'bold' },
  editCard: { backgroundColor: '#f5effb', borderWidth: 1, borderColor: '#b798d5', borderRadius: 14, padding: 16, marginTop: 12 },
  editLabel: { color: '#4b315f', fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  termInput: { color: '#251832', backgroundColor: 'white', borderWidth: 1, borderColor: '#cbb8dd', borderRadius: 9, fontSize: 17, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 },
  definitionInput: { height: 180, color: '#251832', backgroundColor: 'white', borderWidth: 1, borderColor: '#cbb8dd', borderRadius: 9, fontSize: 16, lineHeight: 24, padding: 12 },
  editErrorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, marginTop: 10 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  saveEditButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#6b3ca0', borderRadius: 9, padding: 12 },
  saveEditButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  cancelEditButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#8b769d', borderRadius: 9, padding: 12 },
  cancelEditButtonText: { color: '#4b315f', fontSize: 14, fontWeight: 'bold' },
  assessmentPrompt: { color: '#444', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 16 },
  assessmentRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  reviewButton: { flex: 1, backgroundColor: '#fff3d6', borderWidth: 1, borderColor: '#dfbd6d', borderRadius: 9, padding: 11 },
  reviewButtonSelected: { backgroundColor: '#f3cf78', borderColor: '#a77916' },
  reviewButtonText: { color: '#725b24', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  knownButton: { flex: 1, backgroundColor: '#e3f4e9', borderWidth: 1, borderColor: '#94c5a5', borderRadius: 9, padding: 11 },
  knownButtonSelected: { backgroundColor: '#a9ddb9', borderColor: '#28794c' },
  knownButtonText: { color: '#28794c', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  navigationRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navigationButton: { flex: 1, backgroundColor: '#4b315f', borderRadius: 9, padding: 12 },
  navigationButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
