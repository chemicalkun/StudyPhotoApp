import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Stack } from 'expo-router';

import {
  loadAcademicTerm,
  switchAcademicTerm,
} from '@/services/academic-term-storage';
import {
  academicTermNames,
  createAcademicTermId,
  formatAcademicTerm,
  getDefaultAcademicTerm,
  type AcademicTerm,
  type AcademicTermName,
} from '@/types/academic-term';


export default function AcademicTermScreen() {
  const defaultAcademicTerm = getDefaultAcademicTerm();
  const [academicYear, setAcademicYear] = useState(
    String(defaultAcademicTerm.academicYear)
  );
  const [term, setTerm] = useState<AcademicTermName>(
    defaultAcademicTerm.term
  );
  const [savedAcademicTerm, setSavedAcademicTerm] =
    useState<AcademicTerm>(defaultAcademicTerm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');


  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const savedAcademicTerm = await loadAcademicTerm();

        if (!active) {
          return;
        }

        setAcademicYear(
          String(savedAcademicTerm.academicYear)
        );
        setTerm(savedAcademicTerm.term);
        setSavedAcademicTerm(savedAcademicTerm);
      } catch (error) {
        console.log('学年・学期設定読み込みエラー:', error);

        if (active) {
          setErrorMessage(
            '保存済みの学年・学期設定を読み込めませんでした。'
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


  const performSave = async (
    nextAcademicTerm: AcademicTerm
  ) => {
    try {
      setSaving(true);
      setErrorMessage('');
      setStatusMessage('');

      const result = await switchAcademicTerm(
        nextAcademicTerm
      );

      setAcademicYear(
        String(result.academicTerm.academicYear)
      );
      setTerm(result.academicTerm.term);
      setSavedAcademicTerm(result.academicTerm);
      setStatusMessage(
        `${formatAcademicTerm(result.academicTerm)}の時間割に切り替えました。`
      );
    } catch (error) {
      console.log('学年・学期設定保存エラー:', error);
      setErrorMessage(
        '学年・学期設定を保存できませんでした。'
      );
    } finally {
      setSaving(false);
    }
  };


  const save = () => {
    const parsedYear = Number(academicYear);

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > 2100
    ) {
      setErrorMessage(
        '年度は2000から2100の間で入力してください。'
      );
      setStatusMessage('');
      return;
    }

    const nextAcademicTerm: AcademicTerm = {
      academicYear: parsedYear,
      term,
    };

    if (
      createAcademicTermId(nextAcademicTerm) ===
      createAcademicTermId(savedAcademicTerm)
    ) {
      void performSave(nextAcademicTerm);
      return;
    }

    Alert.alert(
      '時間割を切り替えますか？',
      `${formatAcademicTerm(savedAcademicTerm)}の時間割を保存し、${formatAcademicTerm(nextAcademicTerm)}の時間割を開きます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '切り替える',
          onPress: () => {
            void performSave(nextAcademicTerm);
          },
        },
      ]
    );
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '学年・学期',
          headerBackTitle: '設定',
        }}
      />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>学年・学期</Text>
        <Text style={styles.description}>
          現在の時間割を使用する年度と学期を設定します。
        </Text>

        {loading ? (
          <ActivityIndicator
            style={styles.loadingIndicator}
            color="#31518f"
          />
        ) : (
          <>
            <Text style={styles.label}>年度</Text>
            <View style={styles.yearRow}>
              <Pressable
                style={styles.yearButton}
                accessibilityRole="button"
                accessibilityLabel="年度を1年前にする"
                onPress={() => {
                  const year = Number(academicYear);

                  if (Number.isInteger(year) && year > 2000) {
                    setAcademicYear(String(year - 1));
                  }
                }}
              >
                <Text style={styles.yearButtonText}>−</Text>
              </Pressable>

              <TextInput
                style={styles.yearInput}
                value={academicYear}
                onChangeText={(value) => {
                  setAcademicYear(
                    value.replace(/[^0-9]/g, '').slice(0, 4)
                  );
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
                accessibilityLabel="年度"
              />

              <Text style={styles.yearSuffix}>年度</Text>

              <Pressable
                style={styles.yearButton}
                accessibilityRole="button"
                accessibilityLabel="年度を1年後にする"
                onPress={() => {
                  const year = Number(academicYear);

                  if (Number.isInteger(year) && year < 2100) {
                    setAcademicYear(String(year + 1));
                  }
                }}
              >
                <Text style={styles.yearButtonText}>＋</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>学期</Text>
            <View style={styles.termGrid}>
              {academicTermNames.map((termName) => {
                const selected = termName === term;

                return (
                  <Pressable
                    key={termName}
                    style={[
                      styles.termButton,
                      selected && styles.termButtonSelected,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setTerm(termName);
                      setErrorMessage('');
                      setStatusMessage('');
                    }}
                  >
                    <Text
                      style={[
                        styles.termButtonText,
                        selected && styles.termButtonTextSelected,
                      ]}
                    >
                      {termName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>
                学期を切り替えると、現在の時間割は自動で保存されます。以前の学期に戻すと、その学期の時間割が復元されます。
              </Text>
            </View>

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.saveButtonDisabled,
              ]}
              disabled={saving}
              onPress={save}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : null}
              <Text style={styles.saveButtonText}>
                {saving ? '切り替え中...' : 'この学期に切り替える'}
              </Text>
            </Pressable>

            {statusMessage !== '' ? (
              <Text style={styles.successText}>
                {statusMessage}
              </Text>
            ) : null}
          </>
        )}

        {errorMessage !== '' ? (
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
      </ScrollView>
    </View>
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
    color: '#111',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 24,
  },

  description: {
    color: '#555',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 26,
  },

  loadingIndicator: {
    marginTop: 30,
  },

  label: {
    color: '#333',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 18,
    marginBottom: 10,
  },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  yearButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f3f6',
    borderWidth: 1,
    borderColor: '#c5c8ce',
    borderRadius: 10,
  },

  yearButtonText: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
  },

  yearInput: {
    flex: 1,
    height: 46,
    color: '#111',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#aeb6c5',
    borderRadius: 10,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  yearSuffix: {
    color: '#333',
    fontSize: 15,
  },

  termGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  termButton: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#b8bec9',
    borderRadius: 10,
    backgroundColor: '#f6f7f9',
    paddingVertical: 13,
    alignItems: 'center',
  },

  termButtonSelected: {
    backgroundColor: '#31518f',
    borderColor: '#31518f',
  },

  termButtonText: {
    color: '#444',
    fontSize: 15,
    fontWeight: 'bold',
  },

  termButtonTextSelected: {
    color: 'white',
  },

  noticeCard: {
    backgroundColor: '#fff7df',
    borderWidth: 1,
    borderColor: '#ead08a',
    borderRadius: 10,
    padding: 13,
    marginTop: 24,
  },

  noticeText: {
    color: '#654f1c',
    fontSize: 12,
    lineHeight: 19,
  },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#31518f',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  successText: {
    color: '#28794c',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },

  errorText: {
    color: '#9b2c2c',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 14,
  },
});
