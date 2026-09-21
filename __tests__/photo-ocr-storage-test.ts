import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deletePhotoOcrRecord,
  loadPhotoOcrRecord,
  loadPhotoOcrRecords,
  savePhotoOcrRecord,
} from '@/services/photo-ocr-storage';
import { parsePhotoOcrRecords } from '@/types/photo-ocr';


const blocks = [
  {
    text: '高分子化学',
    confidence: 0.9,
    boundingBox: {
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.1,
    },
  },
];


describe('photo OCR storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('写真ごとにOCR結果を保存して読み込む', async () => {
    await savePhotoOcrRecord('photo-1', blocks);

    const record = await loadPhotoOcrRecord('photo-1');

    expect(record).toMatchObject({
      photoId: 'photo-1',
      text: '高分子化学',
      blocks,
    });
  });

  test('指定した写真のOCR結果だけを削除する', async () => {
    await savePhotoOcrRecord('photo-1', blocks);
    await savePhotoOcrRecord('photo-2', blocks);

    await deletePhotoOcrRecord('photo-1');

    expect(await loadPhotoOcrRecord('photo-1')).toBeNull();
    expect(await loadPhotoOcrRecord('photo-2')).not.toBeNull();
  });

  test('保存済みの全写真のOCR結果を読み込む', async () => {
    await savePhotoOcrRecord('photo-1', blocks);
    await savePhotoOcrRecord('photo-2', blocks);

    const records = await loadPhotoOcrRecords();

    expect(Object.keys(records)).toEqual([
      'photo-1',
      'photo-2',
    ]);
  });
});


describe('parsePhotoOcrRecords', () => {
  test('不正なOCR保存データを拒否する', () => {
    expect(() =>
      parsePhotoOcrRecords('{"photo-1":{"text":123}}')
    ).toThrow('photoOcrRecordsの形式が不正です');
  });
});
