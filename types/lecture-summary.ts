import type { PhotoOcrRecord } from '@/types/photo-ocr';


export type LectureSummaryRecord = {
  id: string;
  subject: string;
  dateKey: string;
  text: string;
  sourceOcrSignature: string;
  createdAt: string;
};


export type LectureSummaryRecords = Record<
  string,
  LectureSummaryRecord
>;


export type LectureSummaryUpdateReason =
  | 'photosChanged'
  | 'photoOrderChanged'
  | 'ocrMissing'
  | 'ocrEdited'
  | 'ocrUpdated'
  | 'noteUpdated'
  | 'unknown';


export const createLectureSummaryId = (
  subject: string,
  dateKey: string
) => JSON.stringify([subject, dateKey]);


export const createLectureSummarySourceSignature = (
  records: Array<
    Pick<PhotoOcrRecord, 'photoId' | 'recognizedAt'> & {
      note?: string;
    }
  >
) => JSON.stringify(
  records.map((record) => {
    const note = record.note?.trim() ?? '';

    return note === ''
      ? [record.photoId, record.recognizedAt]
      : [record.photoId, record.recognizedAt, note];
  })
);


type LectureSummarySourceRecord =
  | [string, string]
  | [string, string, string];


const parseLectureSummarySourceSignature = (
  sourceOcrSignature: string
): LectureSummarySourceRecord[] | null => {
  try {
    const parsedSignature: unknown =
      JSON.parse(sourceOcrSignature);

    if (
      !Array.isArray(parsedSignature) ||
      !parsedSignature.every(
        (item) =>
          Array.isArray(item) &&
          (item.length === 2 || item.length === 3) &&
          typeof item[0] === 'string' &&
          typeof item[1] === 'string' &&
          (
            item.length === 2 ||
            typeof item[2] === 'string'
          )
      )
    ) {
      return null;
    }

    return parsedSignature as LectureSummarySourceRecord[];
  } catch {
    return null;
  }
};


export const getLectureSummarySourcePhotoIds = (
  sourceOcrSignature: string
): string[] | null =>
  parseLectureSummarySourceSignature(
    sourceOcrSignature
  )?.map(([photoId]) => photoId) ?? null;


export const getLectureSummaryUpdateReason = (
  sourceOcrSignature: string,
  currentPhotoIds: string[],
  currentOcrRecords: Pick<
    PhotoOcrRecord,
    'photoId' | 'recognizedAt' | 'manuallyEdited'
  >[],
  currentPhotoNotes: {
    photoId: string;
    note?: string;
  }[] = []
): LectureSummaryUpdateReason | null => {
  const sourceRecords =
    parseLectureSummarySourceSignature(
      sourceOcrSignature
    );

  if (sourceRecords === null) {
    return 'unknown';
  }

  const sourcePhotoIds = sourceRecords.map(
    ([photoId]) => photoId
  );
  const sourcePhotoIdSet = new Set(sourcePhotoIds);

  if (
    sourcePhotoIds.length !== currentPhotoIds.length ||
    currentPhotoIds.some(
      (photoId) => !sourcePhotoIdSet.has(photoId)
    )
  ) {
    return 'photosChanged';
  }

  if (
    sourcePhotoIds.some(
      (photoId, index) => photoId !== currentPhotoIds[index]
    )
  ) {
    return 'photoOrderChanged';
  }

  const currentNoteByPhotoId = new Map(
    currentPhotoNotes.map(({ photoId, note }) => [
      photoId,
      note?.trim() ?? '',
    ])
  );
  const currentOcrPhotoIds = new Set(
    currentOcrRecords.map((record) => record.photoId)
  );

  if (
    currentPhotoIds.some(
      (photoId) =>
        !currentOcrPhotoIds.has(photoId) &&
        (currentNoteByPhotoId.get(photoId) ?? '') === ''
    )
  ) {
    return 'ocrMissing';
  }

  const sourceRecognizedAtByPhotoId = new Map(
    sourceRecords.map(
      ([photoId, recognizedAt]) => [
        photoId,
        recognizedAt,
      ] as const
    )
  );
  const changedOcrRecords = currentOcrRecords.filter(
    (record) =>
      sourceRecognizedAtByPhotoId.get(record.photoId) !==
      record.recognizedAt
  );

  if (
    changedOcrRecords.some(
      (record) => record.manuallyEdited === true
    )
  ) {
    return 'ocrEdited';
  }

  if (changedOcrRecords.length > 0) {
    return 'ocrUpdated';
  }

  const sourceNoteByPhotoId = new Map(
    sourceRecords.map(
      ([photoId, , note]) => [photoId, note?.trim() ?? '']
    )
  );
  if (
    currentPhotoIds.some(
      (photoId) =>
        (sourceNoteByPhotoId.get(photoId) ?? '') !==
        (currentNoteByPhotoId.get(photoId) ?? '')
    )
  ) {
    return 'noteUpdated';
  }

  return null;
};


const isLectureSummaryRecord = (
  value: unknown
): value is LectureSummaryRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<LectureSummaryRecord>;

  return (
    typeof record.id === 'string' &&
    typeof record.subject === 'string' &&
    typeof record.dateKey === 'string' &&
    typeof record.text === 'string' &&
    record.text.trim() !== '' &&
    typeof record.sourceOcrSignature === 'string' &&
    typeof record.createdAt === 'string' &&
    !Number.isNaN(new Date(record.createdAt).getTime()) &&
    record.id === createLectureSummaryId(
      record.subject,
      record.dateKey
    )
  );
};


export const parseLectureSummaryRecords = (
  savedRecords: string
): LectureSummaryRecords => {
  const parsedRecords: unknown = JSON.parse(savedRecords);

  if (
    typeof parsedRecords !== 'object' ||
    parsedRecords === null ||
    Array.isArray(parsedRecords)
  ) {
    throw new Error('lectureSummaryRecordsの形式が不正です');
  }

  const entries = Object.entries(parsedRecords);

  if (
    !entries.every(
      ([summaryId, record]) =>
        isLectureSummaryRecord(record) &&
        record.id === summaryId
    )
  ) {
    throw new Error('lectureSummaryRecordsの形式が不正です');
  }

  return parsedRecords as LectureSummaryRecords;
};
