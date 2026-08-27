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

import {
  isStudyPhotoVisionAvailable,
  recognizeText,
  type RecognizedTextBlock,
} from '../modules/study-photo-vision';


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
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedTextBlocks, setRecognizedTextBlocks] =
    useState<RecognizedTextBlock[]>([]);
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
      setRecognizedTextBlocks([]);
    } catch (error) {
      console.log('時間割画像選択エラー:', error);

      setErrorMessage(
        '時間割画像を選択できませんでした。もう一度お試しください。'
      );
    } finally {
      setSelecting(false);
    }
  };


  const analyzeTimetableImage = async () => {
    if (selectedImage === null || recognizing) {
      return;
    }

    if (!isStudyPhotoVisionAvailable) {
      setErrorMessage(
        '画像認識を試すには、Apple Visionを組み込んだ開発ビルドが必要です。Expo Goでは画像選択まで確認できます。'
      );
      return;
    }

    setRecognizing(true);
    setRecognizedTextBlocks([]);
    setErrorMessage('');

    try {
      const recognizedBlocks = await recognizeText(
        selectedImage.uri
      );

      setRecognizedTextBlocks(recognizedBlocks);

      if (recognizedBlocks.length === 0) {
        setErrorMessage(
          '画像から文字を見つけられませんでした。文字がはっきり見える画像でもう一度お試しください。'
        );
      }
    } catch (error) {
      console.log('時間割画像認識エラー:', error);

      setErrorMessage(
        '時間割画像を解析できませんでした。もう一度お試しください。'
      );
    } finally {
      setRecognizing(false);
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
          Apple Visionを使い、端末内で時間割画像の文字を認識します。今回は認識結果の確認まで行います。
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

      {selectedImage !== null ? (
        <>
          {!isStudyPhotoVisionAvailable ? (
            <View style={styles.developmentBuildBox}>
              <Text style={styles.developmentBuildText}>
                Expo GoにはApple Vision機能が含まれないため、文字認識には開発ビルドが必要です。
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.analyzeButton,
              recognizing && styles.disabledButton,
            ]}
            disabled={recognizing}
            onPress={analyzeTimetableImage}
          >
            {recognizing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.selectButtonText}>
                画像内の文字を認識
              </Text>
            )}
          </Pressable>
        </>
      ) : null}

      {recognizedTextBlocks.length > 0 ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>
            認識した文字（{recognizedTextBlocks.length}件）
          </Text>

          {recognizedTextBlocks.map((block, index) => (
            <View
              style={styles.resultRow}
              key={`${block.text}-${index}`}
            >
              <Text style={styles.resultText}>
                {block.text}
              </Text>

              <Text style={styles.confidenceText}>
                信頼度 {Math.round(block.confidence * 100)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.privacyText}>
        選択した画像と認識結果は外部サービスへ送信しません。
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

  developmentBuildBox: {
    backgroundColor: '#fff7df',
    borderWidth: 1,
    borderColor: '#e4c66d',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },

  developmentBuildText: {
    color: '#6d5410',
    fontSize: 13,
    lineHeight: 20,
  },

  analyzeButton: {
    backgroundColor: '#28794c',
    borderRadius: 10,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 12,
  },

  resultContainer: {
    backgroundColor: '#f7f9fc',
    borderWidth: 1,
    borderColor: '#cdd5e1',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },

  resultTitle: {
    color: '#222',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  resultRow: {
    borderTopWidth: 1,
    borderTopColor: '#dde3ec',
    paddingVertical: 10,
  },

  resultText: {
    color: '#222',
    fontSize: 15,
    lineHeight: 21,
  },

  confidenceText: {
    color: '#777',
    fontSize: 11,
    marginTop: 3,
  },

  privacyText: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
});
