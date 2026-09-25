import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  router,
  Stack,
  useLocalSearchParams,
} from 'expo-router';

import {
  defaultTimetableDisplayOptions,
  loadTimetableDisplayOptions,
  saveTimetableDisplayOptions,
  type TimetableDisplayOptions,
} from '@/utils/timetable-display-options';


export default function TimetableDisplaySettingsScreen() {
  const params = useLocalSearchParams<{
    from?: string;
  }>();
  const headerBackTitle = params.from === 'timetable'
    ? '時間割'
    : '設定';
  const [options, setOptions] =
    useState<TimetableDisplayOptions>(
      defaultTimetableDisplayOptions
    );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const savedOptions =
          await loadTimetableDisplayOptions();

        if (active) {
          setOptions(savedOptions);
        }
      } catch (error) {
        console.log('時間割の表示範囲読み込みエラー:', error);

        if (active) {
          Alert.alert(
            '設定を読み込めませんでした',
            'デフォルトの表示範囲を表示しています。'
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
      await saveTimetableDisplayOptions(options);
      router.back();
    } catch (error) {
      console.log('時間割の表示範囲保存エラー:', error);
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
          title: '表示する曜日・時限',
          headerBackTitle,
        }}
      />

      <Text style={styles.title}>
        表示する曜日・時限
      </Text>
      <Text style={styles.description}>
        大学の時間割に合わせて、土曜日と6限を使用するか選べます。
      </Text>

      {loading ? (
        <ActivityIndicator
          style={styles.loadingIndicator}
          color="#31518f"
        />
      ) : (
        <>
          <View style={styles.optionCard}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>
                土曜日を使用
              </Text>
              <Text style={styles.optionDescription}>
                時間割と画像読み込みに土曜日を表示します。
              </Text>
            </View>
            <Switch
              value={options.showSaturday}
              disabled={saving}
              onValueChange={(showSaturday) => {
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  showSaturday,
                }));
              }}
            />
          </View>

          <View style={styles.optionCard}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>
                6限を使用
              </Text>
              <Text style={styles.optionDescription}>
                時間割と画像読み込みに6限を表示します。
              </Text>
            </View>
            <Switch
              value={options.showSixthPeriod}
              disabled={saving}
              onValueChange={(showSixthPeriod) => {
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  showSixthPeriod,
                }));
              }}
            />
          </View>

          <Text style={styles.notice}>
            オフにしても、すでに保存されている授業・写真・まとめは削除されません。
          </Text>

          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            disabled={saving}
            onPress={save}
          >
            <Text style={styles.saveButtonText}>
              {saving ? '保存中...' : '保存'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 24,
  },

  title: {
    color: '#111',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
  },

  description: {
    color: '#555',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 9,
    marginBottom: 24,
  },

  loadingIndicator: {
    marginTop: 32,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#d9dde5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  optionText: {
    flex: 1,
    marginRight: 16,
  },

  optionTitle: {
    color: '#222',
    fontSize: 17,
    fontWeight: 'bold',
  },

  optionDescription: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  notice: {
    color: '#666',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  saveButton: {
    alignItems: 'center',
    backgroundColor: '#31518f',
    borderRadius: 10,
    padding: 15,
    marginTop: 24,
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
