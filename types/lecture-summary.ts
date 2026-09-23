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


export const createLectureSummaryId = (
  subject: string,
  dateKey: string
) => JSON.stringify([subject, dateKey]);


export const createLectureSummarySourceSignature = (
  records: Pick<
    PhotoOcrRecord,
    'photoId' | 'recognizedAt'
  >[]
) => JSON.stringify(
  records.map((record) => [
    record.photoId,
    record.recognizedAt,
  ])
);


export const getLectureSummarySourcePhotoIds = (
  sourceOcrSignature: string
): string[] | null => {
  try {
    const parsedSignature: unknown =
      JSON.parse(sourceOcrSignature);

    if (
      !Array.isArray(parsedSignature) ||
      !parsedSignature.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === 'string' &&
          typeof item[1] === 'string'
      )
    ) {
      return null;
    }

    return parsedSignature.map(([photoId]) => photoId);
  } catch {
    return null;
  }
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
