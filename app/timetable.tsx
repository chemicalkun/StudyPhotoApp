import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const days = ['月', '火', '水', '木', '金'];
const periods = [1, 2, 3, 4, 5];
const periodTimes = {
  1: { start: '09:00', end: '10:30' },
  2: { start: '10:40', end: '12:10' },
  3: { start: '13:00', end: '14:30' },
  4: { start: '14:40', end: '16:10' },
  5: { start: '16:20', end: '17:50' },
};

export default function TimetableScreen() {
  const [modalVisible, setModalVisible] = useState(false);

  const [selectedDay, setSelectedDay] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  const [subjectName, setSubjectName] = useState('');

  const [timetable, setTimetable] = useState<Record<string, string>>({});
  useEffect(() => {
  const loadTimetable = async () => {
    const savedTimetable = await AsyncStorage.getItem('timetable');

    if (savedTimetable !== null) {
      setTimetable(JSON.parse(savedTimetable));
    }
  };

  loadTimetable();
}, []);

  const handlePress = (day: string, period: number) => {
    setSelectedDay(day);
    setSelectedPeriod(period);

    const key = `${day}-${period}`;

    setSubjectName(timetable[key] ?? '');

    setModalVisible(true);
  };

  const handleSave = async () => {
  if (selectedPeriod === null) {
    return;
  }

  const key = `${selectedDay}-${selectedPeriod}`;

  const newTimetable = {
    ...timetable,
    [key]: subjectName,
  };

  setTimetable(newTimetable);

  await AsyncStorage.setItem(
    'timetable',
    JSON.stringify(newTimetable)
  );

  setModalVisible(false);
};

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>時間割</Text>

      <View style={styles.headerRow}>
        <View style={styles.cornerHeader} />

        {days.map((day) => (
          <View key={day} style={styles.dayHeader}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>

      {periods.map((period) => (
  <View key={period} style={styles.row}>
    <View style={styles.periodHeader}>
      <Text style={styles.headerText}>{period}限</Text>

      <Text style={styles.periodTime}>
        {periodTimes[period as keyof typeof periodTimes].start}
      </Text>

      <Text style={styles.periodTime}>
        〜{periodTimes[period as keyof typeof periodTimes].end}
      </Text>
    </View>

    {days.map((day) => {
      const key = `${day}-${period}`;
      const subject = timetable[key];

      return (
        <Pressable
          key={key}
          style={styles.cell}
          onPress={() => handlePress(day, period)}
        >
          <Text style={styles.cellText}>
            {subject || '＋'}
          </Text>
        </Pressable>
      );
    })}
  </View>
))}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDay}曜日 {selectedPeriod}限
            </Text>

            <Text style={styles.label}>授業名</Text>

            <TextInput
              style={styles.input}
              value={subjectName}
              onChangeText={setSubjectName}
              placeholder="例：高分子化学"
            />

            <Pressable
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 24,
  },

  periodTime: {
    fontSize: 9,
    color: '#666',
  },

  headerRow: {
    flexDirection: 'row',
  },

  row: {
    flexDirection: 'row',
  },

  periodHeader: {
    width: 50,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#aaa',
  },

  dayHeader: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#aaa',
  },

  headerText: {
    fontWeight: 'bold',
    color: 'black',
  },

  cell: {
    flex: 1,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#aaa',
    padding: 4,
  },

  cellText: {
    fontSize: 13,
    color: 'black',
    textAlign: 'center',
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },

  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 24,
  },

  label: {
    fontSize: 16,
    color: 'black',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: 'black',
    marginBottom: 20,
  },

  saveButton: {
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },

  saveButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },

  cancelButton: {
    padding: 12,
  },

  cornerHeader: {
  width: 50,
  height: 50,
  borderWidth: 0.5,
  borderColor: '#aaa',
},

  cancelButtonText: {
    color: 'black',
    textAlign: 'center',
  },
});