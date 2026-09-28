export type PhotoOcrBlock = {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type PhotoOcrRecord = {
  photoId: string;
  text: string;
  blocks: PhotoOcrBlock[];
  recognizedAt: string;
  manuallyEdited?: boolean;
};

export type PhotoOcrRecords = Record<
  string,
  PhotoOcrRecord
>;


const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);


const isPhotoOcrBlock = (
  value: unknown
): value is PhotoOcrBlock => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const block = value as Partial<PhotoOcrBlock>;
  const boundingBox = block.boundingBox;

  return (
    typeof block.text === 'string' &&
    isFiniteNumber(block.confidence) &&
    typeof boundingBox === 'object' &&
    boundingBox !== null &&
    isFiniteNumber(boundingBox.x) &&
    isFiniteNumber(boundingBox.y) &&
    isFiniteNumber(boundingBox.width) &&
    isFiniteNumber(boundingBox.height)
  );
};


const isPhotoOcrRecord = (
  value: unknown
): value is PhotoOcrRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<PhotoOcrRecord>;

  return (
    typeof record.photoId === 'string' &&
    typeof record.text === 'string' &&
    Array.isArray(record.blocks) &&
    record.blocks.every(isPhotoOcrBlock) &&
    typeof record.recognizedAt === 'string' &&
    !Number.isNaN(new Date(record.recognizedAt).getTime()) &&
    (
      record.manuallyEdited === undefined ||
      typeof record.manuallyEdited === 'boolean'
    )
  );
};


export const parsePhotoOcrRecords = (
  savedRecords: string
): PhotoOcrRecords => {
  const parsedRecords: unknown = JSON.parse(savedRecords);

  if (
    typeof parsedRecords !== 'object' ||
    parsedRecords === null ||
    Array.isArray(parsedRecords)
  ) {
    throw new Error('photoOcrRecordsの形式が不正です');
  }

  const entries = Object.entries(parsedRecords);

  if (
    !entries.every(
      ([photoId, record]) =>
        isPhotoOcrRecord(record) &&
        record.photoId === photoId
    )
  ) {
    throw new Error('photoOcrRecordsの形式が不正です');
  }

  return parsedRecords as PhotoOcrRecords;
};
