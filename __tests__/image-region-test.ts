import {
  createNormalizedImageRegion,
  getContainedImageFrame,
  moveNormalizedImageRegion,
  resizeNormalizedImageRegion,
  splitImageRegionForTextRecognition,
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

  test('横に長い読み取り範囲を重なりのある小範囲へ分割する', () => {
    const tiles = splitImageRegionForTextRecognition(
      { x: 0.1, y: 0.2, width: 0.8, height: 0.1 },
      1000,
      500
    );

    expect(tiles).toHaveLength(4);
    expect(tiles[0].x).toBeCloseTo(0.1);
    expect(tiles[3].x + tiles[3].width).toBeCloseTo(0.9);
    expect(tiles[0].height).toBeCloseTo(0.1);
    expect(tiles[0].x + tiles[0].width).toBeGreaterThan(
      tiles[1].x
    );
  });

  test('縦に長い読み取り範囲も小範囲へ分割する', () => {
    const tiles = splitImageRegionForTextRecognition(
      { x: 0.2, y: 0.1, width: 0.1, height: 0.8 },
      500,
      1000
    );

    expect(tiles).toHaveLength(4);
    expect(tiles[0].y).toBeCloseTo(0.1);
    expect(tiles[3].y + tiles[3].height).toBeCloseTo(0.9);
    expect(tiles[0].width).toBeCloseTo(0.1);
  });

  test('極端に長くない範囲は分割しない', () => {
    const region = {
      x: 0.1,
      y: 0.2,
      width: 0.6,
      height: 0.5,
    };

    expect(splitImageRegionForTextRecognition(
      region,
      1000,
      500
    )).toEqual([region]);
  });
});
