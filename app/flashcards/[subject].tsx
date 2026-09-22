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
  createFlashcards,
  getLectureSummaryAvailability,
  type LectureSummaryAvailability,
} from '@/modules/study-photo-intelligence';
import {
  loadFlashcardRecords,
  saveFlashcardAssessment,
  saveFlashcardRecord,
} from '@/services/flashcard-storage';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import { buildExamPreparationSource } from '@/types/exam-preparation';
import {
  createFlashcardRecordId,
  createFlashcardSourceSignature,
  type Flashcard,
  type FlashcardAssessment,
} from '@/types/flashcard';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export default function FlashcardScreen() {
  const params = useLocalSearchParams();
  const subject =
    typeof params.subject === 'string'
      ? params.subject
      : '';

  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [cardOrder, setCardOrder] = useState<number[]>([]);
  const [currentCardPosition, setCurrentCardPosition] =
    useState(0);
  const [showDefinition, setShowDefinition] =
    useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewRound, setIsReviewRound] = useState(false);
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
          const canUseSavedRecord =
            savedRecord !== undefined &&
            savedRecord.sourceSummarySignature ===
              createFlashcardSourceSignature(
                subjectSummaries
              );

          setSummaries(subjectSummaries);
          setAvailability(modelAvailability);
          const loadedCards = canUseSavedRecord
            ? savedRecord.cards
            : [];

          setCards(loadedCards);
          setCardOrder(
            loadedCards.map((_, index) => index)
          );
          setAssessments(
            canUseSavedRecord
              ? savedRecord.assessments ?? {}
              : {}
          );
          setIsSaved(canUseSavedRecord);
          setCurrentCardPosition(0);
          setShowDefinition(false);
          setIsFinished(false);
          setIsReviewRound(false);
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
    }, [subject])
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
      setIsSaved(false);

      const generatedCards = await createFlashcards(source);
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

      setCards(validCards);
      setCardOrder(validCards.map((_, index) => index));
      setCurrentCardPosition(0);
      setShowDefinition(false);
      setIsFinished(false);
      setIsReviewRound(false);
      setAssessments({});

      try {
        await saveFlashcardRecord(
          subject,
          validCards,
          createFlashcardSourceSignature(summaries)
        );
        setIsSaved(true);
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
          headerBackTitle: '試験対策',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
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
          <Text style={styles.errorText}>{loadError}</Text>
        ) : null}

        {!loading && loadError === '' ? (
          <>
            <Text style={styles.notice}>
              {summaries.length}回分のまとめから重要語句を8枚作成し、別のAIが説明を再確認します。
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

            {isFinished && cards.length > 0 ? (
              <View style={styles.completionCard}>
                <Text style={styles.completionTitle}>
                  学習を終了しました
                </Text>
                <Text style={styles.completionText}>
                  覚えた {knownCount}枚
                  {'\n'}あとで復習 {reviewCount}枚
                  {'\n'}未評価 {unansweredCount}枚
                </Text>

                {reviewCardIndexes.length > 0 ? (
                  <Pressable
                    style={styles.retryReviewButton}
                    onPress={() => {
                      setCardOrder(reviewCardIndexes);
                      setCurrentCardPosition(0);
                      setShowDefinition(false);
                      setIsFinished(false);
                      setIsReviewRound(true);
                    }}
                  >
                    <Text style={styles.retryReviewButtonText}>
                      あとで復習だけ見返す
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.retryButton}
                  onPress={() => {
                    setCardOrder(
                      cards.map((_, index) => index)
                    );
                    setCurrentCardPosition(0);
                    setShowDefinition(false);
                    setIsFinished(false);
                    setIsReviewRound(false);
                  }}
                >
                  <Text style={styles.retryButtonText}>
                    すべてのカードを見直す
                  </Text>
                </Pressable>
              </View>
            ) : currentCard !== null ? (
              <View style={styles.cardSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {isReviewRound ? '復習 ' : 'カード '}
                    {currentCardPosition + 1} / {cardOrder.length}
                  </Text>
                  {isSaved ? (
                    <Text style={styles.savedText}>端末に保存済み</Text>
                  ) : null}
                </View>

                <Text style={styles.assessmentSummary}>
                  覚えた {knownCount}枚・あとで復習 {reviewCount}枚
                </Text>

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

                {showDefinition ? (
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

                <View style={styles.navigationRow}>
                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentCardPosition === 0 &&
                        styles.disabledButton,
                    ]}
                    disabled={currentCardPosition === 0}
                    onPress={() => {
                      setCurrentCardPosition(
                        (position) => position - 1
                      );
                      setShowDefinition(false);
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
                        return;
                      }

                      setCurrentCardPosition(
                        (position) => position + 1
                      );
                      setShowDefinition(false);
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      {currentCardPosition === cardOrder.length - 1
                        ? '終了する'
                        : '次のカード'}
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
  notice: { color: '#555', backgroundColor: '#f5effb', borderRadius: 10, fontSize: 13, lineHeight: 20, padding: 13 },
  generateButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#6b3ca0', borderRadius: 10, padding: 14, marginTop: 14 },
  generateButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  disabledButton: { opacity: 0.45 },
  unavailableText: { color: '#725b24', backgroundColor: '#fff3d6', borderRadius: 8, fontSize: 13, lineHeight: 20, padding: 12, marginTop: 14 },
  errorText: { color: '#9b2c2c', fontSize: 13, lineHeight: 20, marginTop: 12 },
  completionCard: { backgroundColor: '#f5effb', borderWidth: 1, borderColor: '#b798d5', borderRadius: 14, padding: 20, marginTop: 22 },
  completionTitle: { color: '#6b3ca0', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  completionText: { color: '#333', fontSize: 15, lineHeight: 25, textAlign: 'center' },
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
