import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { router, Stack } from 'expo-router';

import {
  defaultReviewDisplayOptions,
  loadReviewDisplayOptions,
  saveReviewDisplayOptions,
  type ReviewDisplayOptions,
} from '@/utils/review-display-options';


type ReviewDisplayOptionKey = Exclude<
  keyof ReviewDisplayOptions,
  'subjectProgressSortMode' | 'subjectProgressFilterMode'
>;


const reviewDisplayItems: {
  key: ReviewDisplayOptionKey;
  title: string;
  description: string;
}[] = [
  {
    key: 'showReviewQueue',
    title: '復習待ち',
    description: '未回答・あとで復習・更新待ちの学習項目と重要写真をまとめて表示します。',
  },
  {
    key: 'showSubjectProgress',
    title: '授業ごとの進捗',
    description: '覚えた数、復習待ち、まとめの状態を授業別に表示します。',
  },
  {
    key: 'showImportantPhotos',
    title: '重要な写真',
    description: '重要マークを付けた写真の一覧を表示します。',
  },
  {
    key: 'showPhotoNotes',
    title: '写真メモ',
    description: 'メモを保存した写真の一覧を表示します。',
  },
];


export default function ReviewDisplaySettingsScreen() {
  const [options, setOptions] =
    useState<ReviewDisplayOptions>(
      defaultReviewDisplayOptions
    );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const savedOptions = await loadReviewDisplayOptions();

        if (active) {
          setOptions(savedOptions);
        }
      } catch (error) {
        console.log('復習タブ表示設定読み込みエラー:', error);

        if (active) {
          Alert.alert(
            '設定を読み込めませんでした',
            'すべて表示する設定を使用します。'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);


  const save = async () => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      await saveReviewDisplayOptions(options);
      router.back();
    } catch (error) {
      console.log('復習タブ表示設定保存エラー:', error);
      Alert.alert(
        '設定を保存できませんでした',
        'もう一度お試しください。'
      );
    } finally {
      setSaving(false);
    }
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '復習タブの表示項目',
          headerBackTitle: '設定',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.title}>
          復習タブの表示項目
        </Text>
        <Text style={styles.description}>
          復習タブ上部に表示する欄を選択できます。
        </Text>

        {loading ? (
          <ActivityIndicator
            style={styles.loadingIndicator}
            color="#31518f"
          />
        ) : (
          <>
            <View style={styles.optionsCard}>
              {reviewDisplayItems.map((item, index) => (
                <View key={item.key}>
                  {index > 0 ? (
                    <View style={styles.divider} />
                  ) : null}

                  <View style={styles.optionRow}>
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {item.description}
                      </Text>
                    </View>

                    <Switch
                      value={options[item.key]}
                      disabled={saving}
                      onValueChange={(value) => {
                        setOptions((currentOptions) => ({
                          ...currentOptions,
                          [item.key]: value,
                        }));
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.notice}>
              オフにしても、写真・メモ・学習状況は削除されません。
            </Text>

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              disabled={saving}
              accessibilityRole="button"
              onPress={() => {
                void save();
              }}
            >
              <Text style={styles.saveButtonText}>
                {saving ? '保存中...' : '保存'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
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
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
  },

  description: {
    color: '#555',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
  },

  loadingIndicator: {
    marginTop: 32,
  },

  optionsCard: {
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#d9dde5',
    borderRadius: 12,
    overflow: 'hidden',
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },

  optionText: {
    flex: 1,
  },

  optionTitle: {
    color: '#222',
    fontSize: 16,
    fontWeight: 'bold',
  },

  optionDescription: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#d9dde5',
    marginLeft: 16,
  },

  notice: {
    color: '#666',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 14,
  },

  saveButton: {
    alignItems: 'center',
    backgroundColor: '#31518f',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 22,
  },

  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.5,
  },
});
