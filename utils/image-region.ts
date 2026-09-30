export type NormalizedImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};


export type ImageDisplayFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};


export type ImageRegionCorner =
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight';


type Point = {
  x: number;
  y: number;
};


const clamp = (
  value: number,
  minimum: number,
  maximum: number
) => Math.min(Math.max(value, minimum), maximum);


export const getContainedImageFrame = ({
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight,
}: {
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
}): ImageDisplayFrame | null => {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
};


export const createNormalizedImageRegion = (
  start: Point,
  end: Point,
  frame: ImageDisplayFrame,
  minimumSize = 0.03
): NormalizedImageRegion | null => {
  if (frame.width <= 0 || frame.height <= 0) {
    return null;
  }

  const startX = clamp(start.x, frame.x, frame.x + frame.width);
  const startY = clamp(start.y, frame.y, frame.y + frame.height);
  const endX = clamp(end.x, frame.x, frame.x + frame.width);
  const endY = clamp(end.y, frame.y, frame.y + frame.height);
  const x = (Math.min(startX, endX) - frame.x) / frame.width;
  const y = (Math.min(startY, endY) - frame.y) / frame.height;
  const width = Math.abs(endX - startX) / frame.width;
  const height = Math.abs(endY - startY) / frame.height;

  return width < minimumSize || height < minimumSize
    ? null
    : { x, y, width, height };
};


export const moveNormalizedImageRegion = (
  region: NormalizedImageRegion,
  deltaX: number,
  deltaY: number
): NormalizedImageRegion => ({
  ...region,
  x: clamp(region.x + deltaX, 0, 1 - region.width),
  y: clamp(region.y + deltaY, 0, 1 - region.height),
});


export const resizeNormalizedImageRegion = (
  region: NormalizedImageRegion,
  corner: ImageRegionCorner,
  deltaX: number,
  deltaY: number,
  minimumSize = 0.05
): NormalizedImageRegion => {
  const originalLeft = region.x;
  const originalTop = region.y;
  const originalRight = region.x + region.width;
  const originalBottom = region.y + region.height;
  const movesLeft =
    corner === 'topLeft' || corner === 'bottomLeft';
  const movesTop =
    corner === 'topLeft' || corner === 'topRight';
  const left = movesLeft
    ? clamp(
        originalLeft + deltaX,
        0,
        originalRight - minimumSize
      )
    : originalLeft;
  const right = movesLeft
    ? originalRight
    : clamp(
        originalRight + deltaX,
        originalLeft + minimumSize,
        1
      );
  const top = movesTop
    ? clamp(
        originalTop + deltaY,
        0,
        originalBottom - minimumSize
      )
    : originalTop;
  const bottom = movesTop
    ? originalBottom
    : clamp(
        originalBottom + deltaY,
        originalTop + minimumSize,
        1
      );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};


export const splitImageRegionForTextRecognition = (
  region: NormalizedImageRegion,
  imageWidth: number,
  imageHeight: number,
  maximumTileAspectRatio = 4,
  maximumTileCount = 12,
  overlapRatio = 0.08
): NormalizedImageRegion[] => {
  const pixelWidth = region.width * imageWidth;
  const pixelHeight = region.height * imageHeight;

  if (
    pixelWidth <= 0 ||
    pixelHeight <= 0 ||
    maximumTileAspectRatio <= 0 ||
    maximumTileCount <= 1
  ) {
    return [region];
  }

  const horizontalTileCount = Math.min(
    Math.ceil(
      pixelWidth / pixelHeight / maximumTileAspectRatio
    ),
    maximumTileCount
  );
  const verticalTileCount = Math.min(
    Math.ceil(
      pixelHeight / pixelWidth / maximumTileAspectRatio
    ),
    maximumTileCount
  );

  if (horizontalTileCount > 1) {
    const tileWidth = region.width / horizontalTileCount;
    const overlap = tileWidth * overlapRatio;

    return Array.from(
      { length: horizontalTileCount },
      (_, index) => {
        const left = region.x + tileWidth * index -
          (index > 0 ? overlap / 2 : 0);
        const right = region.x + tileWidth * (index + 1) +
          (index < horizontalTileCount - 1
            ? overlap / 2
            : 0);

        return {
          x: left,
          y: region.y,
          width: right - left,
          height: region.height,
        };
      }
    );
  }

  if (verticalTileCount > 1) {
    const tileHeight = region.height / verticalTileCount;
    const overlap = tileHeight * overlapRatio;

    return Array.from(
      { length: verticalTileCount },
      (_, index) => {
        const top = region.y + tileHeight * index -
          (index > 0 ? overlap / 2 : 0);
        const bottom = region.y + tileHeight * (index + 1) +
          (index < verticalTileCount - 1
            ? overlap / 2
            : 0);

        return {
          x: region.x,
          y: top,
          width: region.width,
          height: bottom - top,
        };
      }
    );
  }

  return [region];
};


export const toVisionImageRegion = (
  region: NormalizedImageRegion
): NormalizedImageRegion => {
  const x = clamp(region.x, 0, 1);
  const top = clamp(region.y, 0, 1);
  const right = clamp(region.x + region.width, x, 1);
  const bottom = clamp(region.y + region.height, top, 1);

  return {
    x,
    y: 1 - bottom,
    width: right - x,
    height: bottom - top,
  };
};
