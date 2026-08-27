import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';


type SelectedTimetableImage = {
  uri: string;
  fileName: string | null;
  width: number;
  height: number;
};


export default function TimetableImportScreen() {
  const [selectedImage, setSelectedImage] =
    useState<SelectedTimetableImage | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');


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
        setErrorMessage(
          '時間割画像を選ぶには、写真ライブラリへのアクセスが必要です。'
        );
        return;
      }

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
    } catch (error) {
      console.log('時間割画像選択エラー:', error);

      setErrorMessage(
        '時間割画像を選択できませんでした。もう一度お試しください。'
      );
    } finally {
      setSelecting(false);
    }
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Stack.Screen
        options={{ title: '時間割画像から登録' }}
      />

      <Text style={styles.title}>
        時間割画像から登録
      </Text>

      <Text style={styles.description}>
        時間割のスクリーンショットや保存画像を1枚選んでください。
      </Text>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          現在は画像選択とプレビューまで対応しています。画像認識と登録内容の確認は次のステップで追加します。
        </Text>
      </View>

      {errorMessage !== '' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
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

      <Text style={styles.privacyText}>
        この段階では、選択した画像を外部サービスへ送信しません。
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

  privacyText: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
});
