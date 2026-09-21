import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';

import { loadExamPreparationRecords } from '@/services/exam-preparation-storage';
import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
import {
  createExamPreparationRecordId,
  createExamPreparationSourceSignature,
  type ExamPreparationRecords,
} from '@/types/exam-preparation';
import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


type ReviewMode = 'lecture' | 'subject';


const getDateLabel = (dateKey: string) => {
  const [, month, day] = dateKey.split('-');

  if (month === undefined || day === undefined) {
    return dateKey;
  }

  return `${Number(month)}月${Number(day)}日`;
};


export default function ReviewScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const lectureSwipeX = useRef(
    new Animated.Value(0)
  ).current;
  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [selectedSummary, setSelectedSummary] =
    useState<LectureSummaryRecord | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reviewMode, setReviewMode] =
    useState<ReviewMode>('subject');
  const [selectedLectureSubject, setSelectedLectureSubject] =
    useState<string | null>(null);
  const [examPreparationRecords, setExamPreparationRecords] =
    useState<ExamPreparationRecords>({});

  const subjectGroups = Object.entries(
    summaries.reduce<Record<string, LectureSummaryRecord[]>>(
      (groups, summary) => {
        const subjectSummaries =
          groups[summary.subject] ?? [];

        groups[summary.subject] = [
          ...subjectSummaries,
          summary,
        ].sort((a, b) =>
          a.dateKey.localeCompare(b.dateKey)
        );

        return groups;
      },
      {}
    )
  ).sort(([subjectA], [subjectB]) =>
    subjectA.localeCompare(subjectB, 'ja')
  );
  const selectedSubjectSummaries =
    selectedLectureSubject === null
      ? []
      : subjectGroups.find(
          ([groupSubject]) =>
            groupSubject === selectedLectureSubject
        )?.[1] ?? [];
  const selectedSummaryLectureNumber =
    selectedSummary === null
      ? null
      : subjectGroups
          .find(
            ([groupSubject]) =>
              groupSubject === selectedSummary.subject
          )?.[1]
          .findIndex(
            (summary) => summary.id === selectedSummary.id
          ) ?? -1;

  const lectureSubjectSwipeResponder =
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const horizontalDistance =
          Math.abs(gestureState.dx);
        const verticalDistance =
          Math.abs(gestureState.dy);

        return (
          selectedLectureSubject !== null &&
          gestureState.numberActiveTouches === 1 &&
          gestureState.dx > 12 &&
          horizontalDistance > verticalDistance
        );
      },
      onPanResponderMove: (_, gestureState) => {
        lectureSwipeX.setValue(
          Math.max(0, gestureState.dx)
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= screenWidth * 0.27) {
          Animated.timing(lectureSwipeX, {
            toValue: screenWidth,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setSelectedLectureSubject(null);
            lectureSwipeX.setValue(0);
          });
          return;
        }

        Animated.spring(lectureSwipeX, {
          toValue: 0,
          speed: 22,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(lectureSwipeX, {
          toValue: 0,
          speed: 22,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
      },
    });


  useFocusEffect(
    useCallback(() => {
      const loadSummaries = async () => {
        try {
          setLoadError('');
          setSelectedLectureSubject(null);

          const records =
            await loadLectureSummaryRecords();
          const sortedSummaries = Object.values(records)
            .sort((a, b) => {
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            });

          setSummaries(sortedSummaries);

          try {
            const savedExamPreparations =
              await loadExamPreparationRecords();

            setExamPreparationRecords(
              savedExamPreparations
            );
          } catch (examPreparationError) {
            console.log(
              '試験対策保存状態読み込みエラー:',
              examPreparationError
            );
            setExamPreparationRecords({});
          }
        } catch (error) {
          console.log('復習まとめ読み込みエラー:', error);
          setSummaries([]);
          setLoadError(
            '保存済みの授業まとめを読み込めませんでした。'
          );
        }
      };

      void loadSummaries();
    }, [])
  );


  return (
    <View style={styles.container}>
      <ScrollView
        {...lectureSubjectSwipeResponder.panHandlers}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>
          復習
        </Text>

        <Text style={styles.subtitle}>
          見たい単位を選んで復習
        </Text>

        {loadError !== '' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {loadError}
            </Text>
          </View>
        ) : null}

        {summaries.length === 0 && loadError === '' ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              まだ授業まとめがありません
            </Text>

            <Text style={styles.emptyText}>
              授業写真の文字を認識し、「この回のまとめを作成」を押すとここに表示されます。
            </Text>
          </View>
        ) : (
          <>
            <View
              style={styles.modeSelector}
              accessibilityRole="tablist"
            >
              <Pressable
                style={[
                  styles.modeButton,
                  reviewMode === 'subject' &&
                    styles.modeButtonActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: reviewMode === 'subject',
                }}
                onPress={() => setReviewMode('subject')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    reviewMode === 'subject' &&
                      styles.modeButtonTextActive,
                  ]}
                >
                  授業全体
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeButton,
                  reviewMode === 'lecture' &&
                    styles.modeButtonActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: reviewMode === 'lecture',
                }}
                onPress={() => {
                  setReviewMode('lecture');
                  setSelectedLectureSubject(null);
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    reviewMode === 'lecture' &&
                      styles.modeButtonTextActive,
                  ]}
                >
                  授業回ごと
                </Text>
              </Pressable>
            </View>

            {reviewMode === 'subject' ? (
              <View>
                <Text style={styles.sectionTitle}>
                  授業全体のまとめ
                </Text>

                <Text style={styles.sectionDescription}>
                  保存済みの授業回まとめから、科目全体の試験対策を表示します。
                </Text>

                <View style={styles.examList}>
                  {subjectGroups.map(
                    ([groupSubject, subjectSummaries]) => {
                      const savedExamPreparation =
                        examPreparationRecords[
                          createExamPreparationRecordId(
                            groupSubject
                          )
                        ];
                      const isSaved =
                        savedExamPreparation !== undefined &&
                        savedExamPreparation.sourceSummarySignature ===
                          createExamPreparationSourceSignature(
                            subjectSummaries
                          );

                      return (
                        <Pressable
                          key={groupSubject}
                          style={styles.examCard}
                          accessibilityRole="button"
                          accessibilityLabel={`${groupSubject}の授業全体まとめを開く、${isSaved ? '保存済み' : '未作成'}`}
                          onPress={() => {
                            router.push({
                              pathname: '/exam-prep/[subject]',
                              params: { subject: groupSubject },
                            });
                          }}
                        >
                          <View style={styles.examCardText}>
                            <Text style={styles.examSubject}>
                              {groupSubject}
                            </Text>

                            <Text style={styles.examCount}>
                              {subjectSummaries.length}回分のまとめ
                            </Text>

                            <Text
                              style={[
                                styles.examStatus,
                                isSaved
                                  ? styles.examStatusSaved
                                  : styles.examStatusNotCreated,
                              ]}
                            >
                              {isSaved ? '保存済み' : '未作成'}
                            </Text>
                          </View>

                          <Text style={styles.examOpenText}>
                            {isSaved
                              ? '保存済みを見る ›'
                              : '作成する ›'}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </View>
            ) : (
              <View>
                {selectedLectureSubject === null ? (
                  <>
                    <Text style={styles.sectionTitle}>
                      授業を選択
                    </Text>

                    <Text style={styles.sectionDescription}>
                      授業を選んで、回ごとのまとめを表示します。
                    </Text>

                    <View style={styles.summaryList}>
                      {subjectGroups.map(
                        ([groupSubject, subjectSummaries]) => (
                          <Pressable
                            key={groupSubject}
                            style={styles.lectureSubjectCard}
                            accessibilityRole="button"
                            accessibilityLabel={`${groupSubject}、${subjectSummaries.length}回分のまとめ`}
                            onPress={() =>
                              setSelectedLectureSubject(
                                groupSubject
                              )
                            }
                          >
                            <View style={styles.lectureSubjectText}>
                              <Text style={styles.subjectName}>
                                {groupSubject}
                              </Text>

                              <Text style={styles.lectureCount}>
                                {subjectSummaries.length}回分のまとめ
                              </Text>
                            </View>

                            <Text style={styles.openTextInline}>
                              授業回を見る ›
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  </>
                ) : (
                  <Animated.View
                    style={{
                      transform: [
                        { translateX: lectureSwipeX },
                      ],
                    }}
                  >
                    <Pressable
                      style={styles.subjectBackButton}
                      accessibilityRole="button"
                      accessibilityLabel="授業選択に戻る"
                      hitSlop={10}
                      onPress={() =>
                        setSelectedLectureSubject(null)
                      }
                    >
                      <Text style={styles.subjectBackButtonText}>
                        ‹ 授業を選び直す
                      </Text>
                    </Pressable>

                    <Text style={styles.sectionTitle}>
                      {selectedLectureSubject}
                    </Text>

                    <Text style={styles.sectionDescription}>
                      見たい授業回を選択してください。
                    </Text>

                    <View style={styles.summaryList}>
                      {selectedSubjectSummaries.map(
                        (summary, index) => (
                          <Pressable
                            key={summary.id}
                            style={styles.summaryCard}
                            accessibilityRole="button"
                            accessibilityLabel={`${selectedLectureSubject}第${index + 1}回のまとめを開く`}
                            onPress={() =>
                              setSelectedSummary(summary)
                            }
                          >
                            <View style={styles.cardHeader}>
                              <Text style={styles.subjectName}>
                                第{index + 1}回
                              </Text>

                              <Text style={styles.dateText}>
                                {getDateLabel(summary.dateKey)}
                              </Text>
                            </View>

                            <Text
                              style={styles.summaryPreview}
                              numberOfLines={2}
                            >
                              {summary.text}
                            </Text>

                            <Text style={styles.openText}>
                              まとめを開く ›
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  </Animated.View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={selectedSummary !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSummary(null)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedSummary?.subject}
              {selectedSummaryLectureNumber !== null &&
              selectedSummaryLectureNumber >= 0
                ? ` 第${selectedSummaryLectureNumber + 1}回`
                : ''}
            </Text>

            <Text style={styles.modalDate}>
              {selectedSummary === null
                ? ''
                : getDateLabel(selectedSummary.dateKey)}
            </Text>

            <ScrollView style={styles.modalScrollView}>
              <Text
                style={styles.modalSummaryText}
                selectable
              >
                {selectedSummary?.text}
              </Text>
            </ScrollView>

            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedSummary(null)}
            >
              <Text style={styles.closeButtonText}>
                閉じる
              </Text>
            </Pressable>
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

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    color: '#111',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
  },

  subtitle: {
    color: '#555',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 18,
  },

  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#ededed',
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },

  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
  },

  modeButtonActive: {
    backgroundColor: 'white',
  },

  modeButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },

  modeButtonTextActive: {
    color: '#31518f',
  },

  errorBox: {
    backgroundColor: '#ffe8e8',
    borderWidth: 1,
    borderColor: '#e39a9a',
    borderRadius: 10,
    padding: 14,
  },

  errorText: {
    color: '#8a2020',
    fontSize: 14,
    lineHeight: 20,
  },

  emptyBox: {
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    padding: 18,
  },

  emptyTitle: {
    color: '#222',
    fontSize: 16,
    fontWeight: 'bold',
  },

  emptyText: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  summaryList: {
    gap: 12,
    marginTop: 12,
  },

  sectionTitle: {
    color: '#222',
    fontSize: 20,
    fontWeight: 'bold',
  },

  sectionDescription: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },

  examList: {
    gap: 10,
    marginTop: 12,
  },

  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f6ff',
    borderWidth: 1,
    borderColor: '#aebee6',
    borderRadius: 12,
    padding: 15,
  },

  examCardText: {
    flex: 1,
  },

  examSubject: {
    color: '#31518f',
    fontSize: 17,
    fontWeight: 'bold',
  },

  examCount: {
    color: '#5d6470',
    fontSize: 12,
    marginTop: 4,
  },

  examStatus: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 'bold',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 7,
  },

  examStatusSaved: {
    color: '#28794c',
    backgroundColor: '#dff2e6',
  },

  examStatusNotCreated: {
    color: '#725b24',
    backgroundColor: '#fff0c8',
  },

  examOpenText: {
    color: '#31518f',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 12,
  },

  summaryCard: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
  },

  lectureSubjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
  },

  lectureSubjectText: {
    flex: 1,
  },

  lectureCount: {
    color: '#5d6470',
    fontSize: 12,
    marginTop: 5,
  },

  openTextInline: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 12,
  },

  subjectBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 8,
  },

  subjectBackButtonText: {
    color: '#31518f',
    fontSize: 18,
    fontWeight: 'bold',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  subjectName: {
    flex: 1,
    color: '#1f633e',
    fontSize: 18,
    fontWeight: 'bold',
  },

  dateText: {
    color: '#555',
    fontSize: 13,
  },

  summaryPreview: {
    color: '#333',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  openText: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 10,
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 22,
  },

  modalContent: {
    maxHeight: '82%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },

  modalTitle: {
    color: '#111',
    fontSize: 21,
    fontWeight: 'bold',
  },

  modalDate: {
    color: '#555',
    fontSize: 13,
    marginTop: 5,
  },

  modalScrollView: {
    flexShrink: 1,
    marginTop: 16,
  },

  modalSummaryText: {
    color: '#222',
    fontSize: 15,
    lineHeight: 23,
  },

  closeButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginTop: 18,
  },

  closeButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
