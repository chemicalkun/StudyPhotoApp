import { StyleSheet, Text, View } from 'react-native';

import {
  extractLectureSummaryReviewPoints,
} from '@/utils/lecture-summary-points';


type LectureSummaryReviewPointsProps = {
  summaryText: string;
};


export function LectureSummaryReviewPoints({
  summaryText,
}: LectureSummaryReviewPointsProps) {
  const points = extractLectureSummaryReviewPoints(summaryText);

  if (points.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>重要語句・復習ポイント</Text>

      {points.map((point) => (
        <View key={point} style={styles.pointRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.pointText} selectable>
            {point}
          </Text>
        </View>
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7fbf8',
    borderWidth: 1,
    borderColor: '#c8dfd0',
    borderRadius: 9,
    padding: 11,
    marginBottom: 12,
  },

  title: {
    color: '#28794c',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },

  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
  },

  bullet: {
    color: '#28794c',
    fontSize: 15,
    lineHeight: 21,
    marginRight: 7,
  },

  pointText: {
    flex: 1,
    color: '#333',
    fontSize: 13,
    lineHeight: 20,
  },
});
