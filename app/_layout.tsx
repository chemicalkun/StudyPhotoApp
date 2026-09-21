import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            title: 'ホーム',
          }}
        />
        <Stack.Screen
          name="camera"
          options={{
            title: '写真を撮影',
            headerBackTitle: 'ホーム',
          }}
        />
        <Stack.Screen
          name="library"
          options={{
            title: '写真を選択',
            headerBackTitle: 'ホーム',
          }}
        />
        <Stack.Screen
          name="timetable"
          options={{
            title: '時間割',
            headerBackTitle: 'ホーム',
          }}
        />
        <Stack.Screen
          name="subject/[subject]"
          options={{
            title: '授業',
            headerBackTitle: 'ホーム',
          }}
        />
        <Stack.Screen
          name="photo/[id]"
          options={{
            title: '写真',
            headerBackTitle: '授業',
          }}
        />
        <Stack.Screen
          name="exam-prep/[subject]"
          options={{
            title: '試験対策',
            headerBackTitle: '復習',
          }}
        />
        <Stack.Screen
          name="timetable-import"
          options={{
            title: '時間割画像から登録',
            headerBackTitle: '時間割',
          }}
        />
        <Stack.Screen
          name="period-settings"
          options={{
            title: '時限設定',
            headerBackTitle: '時間割',
          }}
        />
        <Stack.Screen
          name="backup"
          options={{
            title: 'バックアップ',
            headerBackTitle: 'ホーム',
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
