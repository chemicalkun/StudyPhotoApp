import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';


type LoadErrorCardProps = {
  message: string;
  onRetry: () => void;
};


export function LoadErrorCard({
  message,
  onRetry,
}: LoadErrorCardProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
    >
      <Text style={styles.message}>{message}</Text>
      <Pressable
        style={styles.retryButton}
        accessibilityRole="button"
        accessibilityLabel="データを再読み込み"
        onPress={onRetry}
      >
        <Text style={styles.retryButtonText}>
          再読み込み
        </Text>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffe8e8',
    borderWidth: 1,
    borderColor: '#e39a9a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },

  message: {
    color: '#8a2020',
    fontSize: 14,
    lineHeight: 20,
  },

  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#8a2020',
    borderRadius: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 11,
  },

  retryButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
