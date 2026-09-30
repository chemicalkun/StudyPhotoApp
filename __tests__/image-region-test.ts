import {
  createNormalizedImageRegion,
  getContainedImageFrame,
  moveNormalizedImageRegion,
  resizeNormalizedImageRegion,
  toVisionImageRegion,
} from '@/utils/image-region';


describe('image region', () => {
  test('contain表示された画像の実表示範囲を計算する', () => {
    expect(getContainedImageFrame({
      containerWidth: 300,
      containerHeight: 300,
      imageWidth: 400,
      imageHeight: 200,
    })).toEqual({
      x: 0,
      y: 75,
      width: 300,
      height: 150,
    });
  });

  test('ドラッグ範囲を画像基準の座標へ変換する', () => {
    expect(createNormalizedImageRegion(
      { x: 270, y: 210 },
      { x: 30, y: 90 },
      { x: 0, y: 75, width: 300, height: 150 }
    )).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.8,
      height: 0.8,
    });
  });

  test('小さすぎる選択範囲を無効にする', () => {
    expect(createNormalizedImageRegion(
      { x: 10, y: 10 },
      { x: 11, y: 11 },
      { x: 0, y: 0, width: 100, height: 100 }
    )).toBeNull();
  });

  test('画面左上基準をVisionの左下基準へ変換する', () => {
    expect(toVisionImageRegion({
      x: 0.1,
      y: 0.2,
      width: 0.7,
      height: 0.3,
    })).toEqual({
      x: 0.1,
      y: 0.5,
      width: 0.7,
      height: 0.3,
    });
  });

  test('Visionの許容範囲を小数誤差で超えない', () => {
    expect(toVisionImageRegion({
      x: 0.2,
      y: 0.2,
      width: 0.8000000000000002,
      height: 0.8000000000000002,
    })).toEqual({
      x: 0.2,
      y: 0,
      width: 0.8,
      height: 0.8,
    });
  });

  test('選択範囲を画像外へはみ出さずに移動する', () => {
    expect(moveNormalizedImageRegion(
      { x: 0.2, y: 0.3, width: 0.5, height: 0.4 },
      0.6,
      -0.5
    )).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.4,
    });
  });

  test('四隅を動かして選択範囲を拡大縮小する', () => {
    const region = resizeNormalizedImageRegion(
      { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      'topLeft',
      -0.1,
      0.2
    );

    expect(region.x).toBeCloseTo(0.1);
    expect(region.y).toBeCloseTo(0.4);
    expect(region.width).toBeCloseTo(0.6);
    expect(region.height).toBeCloseTo(0.3);
  });

  test('選択範囲を最小サイズより小さくしない', () => {
    const region = resizeNormalizedImageRegion(
      { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      'bottomRight',
      -0.49,
      -0.49,
      0.1
    );

    expect(region.x).toBeCloseTo(0.2);
    expect(region.y).toBeCloseTo(0.2);
    expect(region.width).toBeCloseTo(0.1);
    expect(region.height).toBeCloseTo(0.1);
  });
});
