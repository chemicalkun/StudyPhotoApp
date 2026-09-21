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
  saveFlashcardRecord,
} from '@/services/flashcard-storage';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import { buildExamPreparationSource } from '@/types/exam-preparation';
import {
  createFlashcardRecordId,
  createFlashcardSourceSignature,
  type Flashcard,
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
  const [currentCardIndex, setCurrentCardIndex] =
    useState(0);
  const [showDefinition, setShowDefinition] =
    useState(false);
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
          setCards(
            canUseSavedRecord ? savedRecord.cards : []
          );
          setIsSaved(canUseSavedRecord);
          setCurrentCardIndex(0);
          setShowDefinition(false);
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
      setCurrentCardIndex(0);
      setShowDefinition(false);

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


  const currentCard = cards[currentCardIndex] ?? null;


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

            {currentCard !== null ? (
              <View style={styles.cardSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    カード {currentCardIndex + 1} / {cards.length}
                  </Text>
                  {isSaved ? (
                    <Text style={styles.savedText}>端末に保存済み</Text>
                  ) : null}
                </View>

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

                <View style={styles.navigationRow}>
                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentCardIndex === 0 &&
                        styles.disabledButton,
                    ]}
                    disabled={currentCardIndex === 0}
                    onPress={() => {
                      setCurrentCardIndex((index) => index - 1);
                      setShowDefinition(false);
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      前のカード
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.navigationButton,
                      currentCardIndex === cards.length - 1 &&
                        styles.disabledButton,
                    ]}
                    disabled={currentCardIndex === cards.length - 1}
                    onPress={() => {
                      setCurrentCardIndex((index) => index + 1);
                      setShowDefinition(false);
                    }}
                  >
                    <Text style={styles.navigationButtonText}>
                      次のカード
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
  cardSection: { marginTop: 22 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { color: '#333', fontSize: 14, fontWeight: 'bold' },
  savedText: { color: '#6b3ca0', fontSize: 11 },
  card: { minHeight: 280, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5effb', borderWidth: 2, borderColor: '#b798d5', borderRadius: 18, padding: 24, marginTop: 12 },
  cardBack: { backgroundColor: '#eee4f7' },
  cardSideLabel: { color: '#6b3ca0', fontSize: 13, fontWeight: 'bold' },
  cardText: { color: '#251832', fontSize: 22, fontWeight: 'bold', lineHeight: 32, textAlign: 'center', marginTop: 14 },
  flipHint: { color: '#755f88', fontSize: 12, marginTop: 24 },
  navigationRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navigationButton: { flex: 1, backgroundColor: '#4b315f', borderRadius: 9, padding: 12 },
  navigationButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
