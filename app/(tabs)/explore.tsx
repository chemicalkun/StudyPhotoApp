import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import { loadLectureSummaryRecords } from '@/services/lecture-summary-storage';
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


export default function ReviewScreen() {
  const [summaries, setSummaries] =
    useState<LectureSummaryRecord[]>([]);
  const [selectedSummary, setSelectedSummary] =
    useState<LectureSummaryRecord | null>(null);
  const [loadError, setLoadError] = useState('');


  useFocusEffect(
    useCallback(() => {
      const loadSummaries = async () => {
        try {
          setLoadError('');

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
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>
          復習
        </Text>

        <Text style={styles.subtitle}>
          保存した授業まとめ
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
          <View style={styles.summaryList}>
            {summaries.map((summary) => (
              <Pressable
                key={summary.id}
                style={styles.summaryCard}
                accessibilityRole="button"
                accessibilityLabel={`${summary.subject}のまとめを開く`}
                onPress={() => setSelectedSummary(summary)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.subjectName}>
                    {summary.subject}
                  </Text>

                  <Text style={styles.dateText}>
                    {getDateLabel(summary.dateKey)}
                  </Text>
                </View>

                <Text
                  style={styles.summaryPreview}
                  numberOfLines={3}
                >
                  {summary.text}
                </Text>

                <Text style={styles.openText}>
                  まとめを開く ›
                </Text>
              </Pressable>
            ))}
          </View>
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
    marginBottom: 28,
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
  },

  summaryCard: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#9bc9aa',
    borderRadius: 12,
    padding: 16,
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
