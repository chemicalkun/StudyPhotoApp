import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useNavigation,
  usePreventRemove,
} from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';

import { parseTimetable } from '@/utils/classification';
import {
  findFirstAvailableTimetableSlot,
  getDuplicateTimetableSlots,
  getFirstInvalidTimetableCandidateIndex,
  getTimetableCandidateOverwrites,
  getTimetableImportValidationError,
  mergeTimetableCandidates,
  reclassifyPhotosForTimetableImport,
  sortTimetableCandidates,
} from '@/utils/timetable-import';
import {
  normalizeTimetableText,
  parseTimetableCandidates,
  type TimetableCandidate,
} from '@/utils/timetable-recognition';
import { parsePhotoRecords } from '@/types/photo';
import { renameSubjectLearningData } from '@/services/subject-learning-data-storage';
import { getTimetableSubjectRenames } from '@/utils/timetable-subject';

import {
  isStudyPhotoVisionAvailable,
  recognizeText,
  type RecognizedTextBlock,
} from '../modules/study-photo-vision';
import {
  defaultTimetableDisplayOptions,
  getEnabledPeriodNumbers,
  getEnabledTimetableDays,
  loadTimetableDisplayOptions,
  type TimetableDisplayOptions,
} from '@/utils/timetable-display-options';


type SelectedTimetableImage = {
  uri: string;
  fileName: string | null;
  width: number;
  height: number;
};


type EditableTimetableCandidate = TimetableCandidate & {
  manuallyAdded?: boolean;
};


export default function TimetableImportScreen() {
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  const candidateContainerY = useRef(0);
  const candidateRowYs = useRef<Record<number, number>>({});
  const [selectedImage, setSelectedImage] =
    useState<SelectedTimetableImage | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recognizedTextBlocks, setRecognizedTextBlocks] =
    useState<RecognizedTextBlock[]>([]);
  const [candidateDrafts, setCandidateDrafts] =
    useState<EditableTimetableCandidate[]>([]);
  const [candidatesSaved, setCandidatesSaved] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [settingsRequired, setSettingsRequired] =
    useState(false);
  const [displayOptions, setDisplayOptions] =
    useState<TimetableDisplayOptions>(
      defaultTimetableDisplayOptions
    );
  const enabledDays = getEnabledTimetableDays(displayOptions);
  const enabledPeriods = getEnabledPeriodNumbers(displayOptions);
  const timetableRecognitionResult = useMemo(
    () => parseTimetableCandidates(recognizedTextBlocks),
    [recognizedTextBlocks]
  );
  const duplicateCandidateSlots = useMemo(
    () => new Set(
      getDuplicateTimetableSlots(candidateDrafts)
    ),
    [candidateDrafts]
  );
  const candidateValidationError = useMemo(
    () => getTimetableImportValidationError(
      candidateDrafts
    ),
    [candidateDrafts]
  );
  const firstInvalidCandidateIndex = useMemo(
    () => getFirstInvalidTimetableCandidateIndex(
      candidateDrafts
    ),
    [candidateDrafts]
  );
  const candidatesAreSorted = useMemo(() =>
    sortTimetableCandidates(candidateDrafts).every(
      (candidate, index) => candidate === candidateDrafts[index]
    ),
  [candidateDrafts]);


  usePreventRemove(
    candidateDrafts.length > 0 && !candidatesSaved,
    ({ data }) => {
      Alert.alert(
        '編集内容を破棄しますか？',
        '時間割候補はまだ保存されていません。',
        [
          {
            text: '編集を続ける',
            style: 'cancel',
          },
          {
            text: '破棄して戻る',
            style: 'destructive',
            onPress: () => {
              navigation.dispatch(data.action);
            },
          },
        ]
      );
    }
  );


  useEffect(() => {
    const loadDisplayOptions = async () => {
      try {
        setDisplayOptions(
          await loadTimetableDisplayOptions()
        );
      } catch (error) {
        console.log(
          '時間割の表示範囲読み込みエラー:',
          error
        );
      }
    };

    void loadDisplayOptions();
  }, []);


  const pickTimetableImage = async () => {
    if (selecting) {
      return;
    }

    setSelecting(true);
    setErrorMessage('');

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setSettingsRequired(
          !permissionResult.canAskAgain
        );
        setErrorMessage(
          permissionResult.canAskAgain
            ? '時間割画像を選ぶには、写真ライブラリへのアクセスが必要です。'
            : 'iPhoneの設定から写真ライブラリへのアクセスを許可してください。'
        );
        return;
      }

      setSettingsRequired(false);

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: false,
          quality: 1,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        throw new Error(
          '選択した時間割画像がありません'
        );
      }

      setSelectedImage({
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        width: asset.width,
        height: asset.height,
      });
      setRecognizedTextBlocks([]);
      setCandidateDrafts([]);
      setCandidatesSaved(false);
    } catch (error) {
      console.log('時間割画像選択エラー:', error);

      setErrorMessage(
        '時間割画像を選択できませんでした。もう一度お試しください。'
      );
    } finally {
      setSelecting(false);
    }
  };


  const analyzeTimetableImage = async () => {
    if (selectedImage === null || recognizing) {
      return;
    }

    if (!isStudyPhotoVisionAvailable) {
      setErrorMessage(
        '画像認識を試すには、Apple Visionを組み込んだ開発ビルドが必要です。Expo Goでは画像選択まで確認できます。'
      );
      return;
    }

    setRecognizing(true);
    setRecognizedTextBlocks([]);
    setCandidateDrafts([]);
    setCandidatesSaved(false);
    setErrorMessage('');

    try {
      const recognizedBlocks = await recognizeText(
        selectedImage.uri
      );
      const recognitionResult =
        parseTimetableCandidates(recognizedBlocks);

      setRecognizedTextBlocks(recognizedBlocks);
      setCandidateDrafts(
        recognitionResult.candidates.filter(
          (candidate) =>
            enabledDays.includes(candidate.day) &&
            enabledPeriods.includes(candidate.period)
        )
      );

      if (recognizedBlocks.length === 0) {
        setErrorMessage(
          '画像から文字を見つけられませんでした。文字がはっきり見える画像でもう一度お試しください。'
        );
      }
    } catch (error) {
      console.log('時間割画像認識エラー:', error);

      setErrorMessage(
        '時間割画像を解析できませんでした。もう一度お試しください。'
      );
    } finally {
      setRecognizing(false);
    }
  };


  const updateCandidate = (
    index: number,
    updates: Partial<TimetableCandidate>
  ) => {
    setCandidatesSaved(false);
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, ...updates }
          : candidate
      )
    );
  };


  const removeCandidate = (index: number) => {
    setCandidatesSaved(false);
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.filter(
        (_, candidateIndex) => candidateIndex !== index
      )
    );
  };


  const addCandidate = () => {
    const availableSlot = findFirstAvailableTimetableSlot(
      candidateDrafts,
      enabledDays,
      enabledPeriods
    );

    if (availableSlot === null) {
      Alert.alert(
        '候補を追加できません',
        '月曜から金曜のすべての時限に候補があります。'
      );
      return;
    }

    setCandidatesSaved(false);
    setCandidateDrafts((currentCandidates) => [
      ...currentCandidates,
      {
        ...availableSlot,
        subject: '',
        confidence: 0,
        manuallyAdded: true,
      },
    ]);
  };


  const sortCandidates = () => {
    setCandidatesSaved(false);
    setCandidateDrafts((currentCandidates) =>
      sortTimetableCandidates(currentCandidates)
    );
  };


  const saveTimetableCandidates = async (
    candidates: TimetableCandidate[]
  ) => {
    if (saving) {
      return;
    }

    setSaving(true);
    setErrorMessage('');

    let originalPhotos: string | null = null;
    let photosWereUpdated = false;
    const learningDataRollbacks: (() => Promise<void>)[] = [];

    try {
      const savedTimetable =
        await AsyncStorage.getItem('timetable');
      const currentTimetable =
        parseTimetable(savedTimetable) ?? {};
      const newTimetable = mergeTimetableCandidates(
        currentTimetable,
        candidates
      );
      const subjectRenames = getTimetableSubjectRenames(
        currentTimetable,
        newTimetable
      );
      let updatedPhotoCount = 0;
      let updatedLearningRecordCount = 0;

      originalPhotos = await AsyncStorage.getItem('photos');

      if (originalPhotos !== null) {
        const currentPhotos =
          parsePhotoRecords(originalPhotos);
        const photoImportResult =
          reclassifyPhotosForTimetableImport(
            currentPhotos,
            currentTimetable,
            candidates
          );

        updatedPhotoCount = photoImportResult.updatedCount;

        if (updatedPhotoCount > 0) {
          await AsyncStorage.setItem(
            'photos',
            JSON.stringify(photoImportResult.photos)
          );
          photosWereUpdated = true;
        }
      }

      for (const subjectRename of subjectRenames) {
        const learningDataUpdate =
          await renameSubjectLearningData(
            subjectRename.previousSubject,
            subjectRename.nextSubject
          );

        updatedLearningRecordCount +=
          learningDataUpdate.updatedRecordCount;
        learningDataRollbacks.push(
          learningDataUpdate.rollback
        );
      }

      await AsyncStorage.setItem(
        'timetable',
        JSON.stringify(newTimetable)
      );

      setCandidatesSaved(true);
      setCandidateDrafts(
        candidates.map((candidate) => ({
          ...candidate,
          subject: candidate.subject.trim(),
        }))
      );

      Alert.alert(
        '時間割を保存しました',
        [
          `${candidates.length}件の授業を保存しました。`,
          updatedPhotoCount > 0
            ? `既存の写真${updatedPhotoCount}枚を更新しました。`
            : '',
          updatedLearningRecordCount > 0
            ? `関連する学習データ${updatedLearningRecordCount}件の授業名も更新しました。`
            : '',
        ].filter(Boolean).join('\n'),
        [
          {
            text: '時間割を確認',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.log('時間割一括保存エラー:', error);

      for (
        let index = learningDataRollbacks.length - 1;
        index >= 0;
        index -= 1
      ) {
        try {
          await learningDataRollbacks[index]();
        } catch (rollbackError) {
          console.log(
            '学習データの授業名復元エラー:',
            rollbackError
          );
        }
      }

      if (photosWereUpdated && originalPhotos !== null) {
        try {
          await AsyncStorage.setItem('photos', originalPhotos);
        } catch (rollbackError) {
          console.log(
            '写真分類の復元エラー:',
            rollbackError
          );
        }
      }

      setErrorMessage(
        '時間割を保存できませんでした。データは変更されていません。もう一度お試しください。'
      );
    } finally {
      setSaving(false);
    }
  };


  const confirmSave = async () => {
    if (saving) {
      return;
    }

    const validationError =
      getTimetableImportValidationError(candidateDrafts);

    if (validationError !== null) {
      Alert.alert('候補を確認してください', validationError);
      return;
    }

    try {
      const savedTimetable =
        await AsyncStorage.getItem('timetable');
      const currentTimetable =
        parseTimetable(savedTimetable) ?? {};
      const overwrites = getTimetableCandidateOverwrites(
        currentTimetable,
        candidateDrafts
      );
      const overwriteMessage =
        overwrites.length > 0
          ? `\n\n上書きされる授業\n${overwrites
              .map(
                (overwrite) =>
                  `${overwrite.day}曜${overwrite.period}限：${overwrite.previousSubject} → ${overwrite.nextSubject}`
              )
              .join('\n')}`
          : '';

      Alert.alert(
        '時間割を保存しますか？',
        `${candidateDrafts.length}件の候補を保存します。候補にない登録済み授業はそのまま残ります。${overwriteMessage}`,
        [
          {
            text: 'キャンセル',
            style: 'cancel',
          },
          {
            text: '保存',
            onPress: () => {
              void saveTimetableCandidates(candidateDrafts);
            },
          },
        ]
      );
    } catch (error) {
      console.log('時間割保存確認エラー:', error);

      setErrorMessage(
        '現在の時間割を確認できませんでした。データは変更されていません。'
      );
    }
  };


  const scrollToFirstInvalidCandidate = () => {
    if (firstInvalidCandidateIndex < 0) {
      return;
    }

    const candidateRowY =
      candidateRowYs.current[firstInvalidCandidateIndex] ?? 0;

    scrollViewRef.current?.scrollTo({
      y: Math.max(
        candidateContainerY.current + candidateRowY - 16,
        0
      ),
      animated: true,
    });
  };


  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Stack.Screen
        options={{
          title: '時間割画像から登録',
          headerBackTitle: '時間割',
          headerBackButtonMenuEnabled: false,
        }}
      />

      <Text style={styles.title}>
        時間割画像から登録
      </Text>

      <Text style={styles.description}>
        時間割のスクリーンショットや保存画像を1枚選んでください。
      </Text>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          Apple Visionを使い、端末内で文字を認識して時間割候補を作ります。曜日・時限・授業名を確認してから保存してください。
        </Text>
      </View>

      {errorMessage !== '' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>

          {settingsRequired ? (
            <Pressable
              style={styles.settingsButton}
              accessibilityRole="button"
              onPress={() => {
                void Linking.openSettings();
              }}
            >
              <Text style={styles.settingsButtonText}>
                iPhoneの設定を開く
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {selectedImage !== null ? (
        <>
          <View style={styles.previewContainer}>
            <Image
              style={styles.previewImage}
              source={{ uri: selectedImage.uri }}
              contentFit="contain"
              onError={() => {
                setErrorMessage(
                  '選択した画像を表示できませんでした。'
                );
              }}
            />
          </View>

          <Text style={styles.imageInfo}>
            {selectedImage.fileName ?? '時間割画像'}
          </Text>

          <Text style={styles.imageSize}>
            {selectedImage.width} × {selectedImage.height}px
          </Text>
        </>
      ) : (
        <View style={styles.emptyPreview}>
          <Text style={styles.emptyPreviewText}>
            選択した時間割画像がここに表示されます
          </Text>
        </View>
      )}

      <Pressable
        style={[
          styles.selectButton,
          selecting && styles.disabledButton,
        ]}
        disabled={selecting}
        onPress={pickTimetableImage}
      >
        {selecting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.selectButtonText}>
            {selectedImage === null
              ? '時間割画像を選択'
              : '別の画像を選択'}
          </Text>
        )}
      </Pressable>

      {selectedImage !== null ? (
        <>
          {!isStudyPhotoVisionAvailable ? (
            <View style={styles.developmentBuildBox}>
              <Text style={styles.developmentBuildText}>
                Expo GoにはApple Vision機能が含まれないため、文字認識には開発ビルドが必要です。
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.analyzeButton,
              recognizing && styles.disabledButton,
            ]}
            disabled={recognizing}
            onPress={analyzeTimetableImage}
          >
            {recognizing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.selectButtonText}>
                文字を認識して候補を作成
              </Text>
            )}
          </Pressable>
        </>
      ) : null}

      {recognizedTextBlocks.length > 0 ? (
        <>
          <View
            style={styles.candidateContainer}
            onLayout={({ nativeEvent }) => {
              candidateContainerY.current =
                nativeEvent.layout.y;
            }}
          >
            <Text style={styles.resultTitle}>
              時間割候補（
              {candidateDrafts.length}件）
            </Text>

            <Text style={styles.detectionSummary}>
              検出した曜日：
              {timetableRecognitionResult.detectedDays.join('・') ||
                'なし'}
              {'\n'}
              検出した時限：
              {timetableRecognitionResult.detectedPeriods
                .map((period) => `${period}限`)
                .join('・') || 'なし'}
            </Text>

            <Text style={styles.confidenceNotice}>
              OCR参考値は文字認識の確実さの目安です。数値が低くても、表示内容が正しければ問題ありません。
            </Text>

            {candidateDrafts.length > 1 ? (
              <Pressable
                style={[
                  styles.sortCandidatesButton,
                  (saving || candidatesAreSorted) &&
                    styles.disabledButton,
                ]}
                disabled={saving || candidatesAreSorted}
                onPress={sortCandidates}
              >
                <Text style={styles.sortCandidatesText}>
                  {candidatesAreSorted
                    ? '曜日・時限順に並んでいます'
                    : '曜日・時限順に並べ替え'}
                </Text>
              </Pressable>
            ) : null}

            {timetableRecognitionResult.warning !== null ? (
              <View style={styles.candidateWarningBox}>
                <Text style={styles.candidateWarningText}>
                  {timetableRecognitionResult.warning}
                </Text>
              </View>
            ) : null}

            {candidateDrafts.map((candidate, index) => {
              const candidateKey =
                `${candidate.day}-${candidate.period}`;
              const subjectIsEmpty =
                candidate.subject.trim() === '';

              return (
                <View
                  style={[
                    styles.candidateRow,
                    duplicateCandidateSlots.has(
                      candidateKey
                    ) && styles.duplicateCandidateRow,
                    subjectIsEmpty && styles.emptyCandidateRow,
                  ]}
                  key={`${candidate.day}-${candidate.period}-${index}`}
                  onLayout={({ nativeEvent }) => {
                    candidateRowYs.current[index] =
                      nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.candidateLabel}>
                    曜日
                  </Text>

                  <View style={styles.selectorRow}>
                    {enabledDays.map((day) => (
                      <Pressable
                        key={day}
                        style={[
                          styles.selectorButton,
                          candidate.day === day &&
                            styles.selectedSelectorButton,
                        ]}
                        disabled={saving}
                        onPress={() =>
                          updateCandidate(index, { day })
                        }
                      >
                        <Text
                          style={[
                            styles.selectorButtonText,
                            candidate.day === day &&
                              styles.selectedSelectorButtonText,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.candidateLabel}>
                    時限
                  </Text>

                  <View style={styles.selectorRow}>
                    {enabledPeriods.map((period) => (
                      <Pressable
                        key={period}
                        style={[
                          styles.selectorButton,
                          candidate.period === period &&
                            styles.selectedSelectorButton,
                        ]}
                        disabled={saving}
                        onPress={() =>
                          updateCandidate(index, { period })
                        }
                      >
                        <Text
                          style={[
                            styles.selectorButtonText,
                            candidate.period === period &&
                              styles.selectedSelectorButtonText,
                          ]}
                        >
                          {period}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.candidateLabel}>
                    授業名
                  </Text>

                  <TextInput
                    style={styles.candidateInput}
                    value={candidate.subject}
                    editable={!saving}
                    placeholder="授業名を入力"
                    onChangeText={(subject) =>
                      updateCandidate(index, { subject })
                    }
                  />

                  <Text style={styles.confidenceText}>
                    {candidate.manuallyAdded
                      ? '手動で追加した候補'
                      : `OCR参考値 ${Math.round(candidate.confidence * 100)}%`}
                  </Text>

                  {duplicateCandidateSlots.has(
                    candidateKey
                  ) ? (
                    <Text style={styles.duplicateCandidateText}>
                      同じ曜日・時限の候補が重複しています
                    </Text>
                  ) : null}

                  {subjectIsEmpty ? (
                    <Text style={styles.emptyCandidateText}>
                      授業名を入力するか、この候補を外してください
                    </Text>
                  ) : null}

                  <Pressable
                    style={styles.removeCandidateButton}
                    disabled={saving}
                    onPress={() => removeCandidate(index)}
                  >
                    <Text style={styles.removeCandidateText}>
                      この候補を外す
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            <Pressable
              style={styles.addCandidateButton}
              disabled={saving}
              onPress={addCandidate}
            >
              <Text style={styles.addCandidateText}>
                候補を追加
              </Text>
            </Pressable>

            <Text style={styles.notSavedText}>
              「確認して保存」を押すまで時間割は変更されません。
            </Text>

            {candidateDrafts.length > 0 ? (
              <>
                {candidateValidationError !== null ? (
                  <Pressable
                    style={styles.validationNavigationButton}
                    accessibilityRole="button"
                    onPress={scrollToFirstInvalidCandidate}
                  >
                    <Text style={styles.validationErrorText}>
                      {candidateValidationError}
                    </Text>

                    <Text style={styles.validationNavigationText}>
                      最初の修正箇所を見る
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[
                    styles.saveCandidatesButton,
                    (saving || candidateValidationError !== null) &&
                      styles.disabledButton,
                  ]}
                  disabled={
                    saving || candidateValidationError !== null
                  }
                  onPress={confirmSave}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.selectButtonText}>
                      確認して保存
                    </Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>

          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>
              認識した文字（{recognizedTextBlocks.length}件）
            </Text>

            {recognizedTextBlocks.map((block, index) => (
              <View
                style={styles.resultRow}
                key={`${block.text}-${index}`}
              >
                <Text style={styles.resultText}>
                  {normalizeTimetableText(block.text)}
                </Text>

                <Text style={styles.confidenceText}>
                  OCR参考値{' '}
                  {Math.round(block.confidence * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.privacyText}>
        選択した画像と認識結果は外部サービスへ送信しません。
      </Text>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    color: 'black',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 20,
  },

  description: {
    color: '#555',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 20,
  },

  noticeBox: {
    backgroundColor: '#eef3ff',
    borderWidth: 1,
    borderColor: '#9eb8ef',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },

  noticeText: {
    color: '#2454a6',
    fontSize: 14,
    lineHeight: 20,
  },

  errorBox: {
    backgroundColor: '#ffe8e8',
    borderWidth: 1,
    borderColor: '#e39a9a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    color: '#8a2020',
    fontSize: 14,
    lineHeight: 20,
  },

  settingsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#8a2020',
    borderRadius: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 11,
  },

  settingsButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },

  previewContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f3f3f3',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    overflow: 'hidden',
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  emptyPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f3f3f3',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  emptyPreviewText: {
    color: '#777',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  imageInfo: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },

  imageSize: {
    color: '#777',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },

  selectButton: {
    backgroundColor: '#2454a6',
    borderRadius: 10,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 24,
  },

  selectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.5,
  },

  developmentBuildBox: {
    backgroundColor: '#fff7df',
    borderWidth: 1,
    borderColor: '#e4c66d',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },

  developmentBuildText: {
    color: '#6d5410',
    fontSize: 13,
    lineHeight: 20,
  },

  analyzeButton: {
    backgroundColor: '#28794c',
    borderRadius: 10,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 12,
  },

  candidateContainer: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },

  detectionSummary: {
    color: '#3d5f49',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },

  confidenceNotice: {
    color: '#587061',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },

  sortCandidatesButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#28794c',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  sortCandidatesText: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
  },

  candidateWarningBox: {
    backgroundColor: '#fff7df',
    borderWidth: 1,
    borderColor: '#e4c66d',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },

  candidateWarningText: {
    color: '#6d5410',
    fontSize: 13,
    lineHeight: 19,
  },

  candidateRow: {
    borderTopWidth: 1,
    borderTopColor: '#c9dfd0',
    paddingVertical: 11,
  },

  duplicateCandidateRow: {
    backgroundColor: '#fff0f0',
    borderColor: '#d98282',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },

  duplicateCandidateText: {
    color: '#a13333',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 18,
    marginTop: 7,
  },

  emptyCandidateRow: {
    backgroundColor: '#fff8e6',
    borderColor: '#d4a846',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },

  emptyCandidateText: {
    color: '#8a6518',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 18,
    marginTop: 7,
  },

  candidateLabel: {
    color: '#3d5f49',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 5,
  },

  selectorRow: {
    flexDirection: 'row',
    gap: 6,
  },

  selectorButton: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },

  selectedSelectorButton: {
    backgroundColor: '#28794c',
    borderColor: '#28794c',
  },

  selectorButtonText: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
  },

  selectedSelectorButtonText: {
    color: 'white',
  },

  candidateInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 8,
    color: '#1f3326',
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  removeCandidateButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 5,
  },

  removeCandidateText: {
    color: '#a13333',
    fontSize: 12,
  },

  addCandidateButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#31518f',
    borderRadius: 9,
    paddingVertical: 12,
    marginTop: 2,
  },

  addCandidateText: {
    color: '#31518f',
    fontSize: 14,
    fontWeight: 'bold',
  },

  notSavedText: {
    color: '#587061',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  validationErrorText: {
    color: '#a13333',
    fontSize: 12,
    lineHeight: 18,
  },

  validationNavigationButton: {
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#d98282',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },

  validationNavigationText: {
    color: '#8a2020',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 5,
  },

  saveCandidatesButton: {
    backgroundColor: '#28794c',
    borderRadius: 10,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 14,
  },

  resultContainer: {
    backgroundColor: '#f7f9fc',
    borderWidth: 1,
    borderColor: '#cdd5e1',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
  },

  resultTitle: {
    color: '#222',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  resultRow: {
    borderTopWidth: 1,
    borderTopColor: '#dde3ec',
    paddingVertical: 10,
  },

  resultText: {
    color: '#222',
    fontSize: 15,
    lineHeight: 21,
  },

  confidenceText: {
    color: '#777',
    fontSize: 11,
    marginTop: 3,
  },

  privacyText: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
});
