import type { PhotoOcrRecords } from '@/types/photo-ocr';
import type { PhotoRecord } from '@/types/photo';


export type PhotoTextSearchResult = {
  photo: PhotoRecord;
  preview: string;
};


const createPreview = (
  text: string,
  normalizedQuery: string
) => {
  const flattenedText = text.replace(/\s+/g, ' ').trim();
  const normalizedText = flattenedText.toLocaleLowerCase('ja-JP');
  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex < 0 || flattenedText.length <= 100) {
    return flattenedText;
  }

  const start = Math.max(0, matchIndex - 35);
  const end = Math.min(
    flattenedText.length,
    matchIndex + normalizedQuery.length + 55
  );

  return [
    start > 0 ? '…' : '',
    flattenedText.slice(start, end),
    end < flattenedText.length ? '…' : '',
  ].join('');
};


export const searchRecognizedPhotos = (
  photos: PhotoRecord[],
  ocrRecords: PhotoOcrRecords,
  query: string,
  limit = 20
): PhotoTextSearchResult[] => {
  const normalizedQuery = query
    .trim()
    .toLocaleLowerCase('ja-JP');

  if (normalizedQuery === '' || limit <= 0) {
    return [];
  }

  return [...photos]
    .sort(
      (a, b) =>
        new Date(b.takenAt).getTime() -
        new Date(a.takenAt).getTime()
    )
    .flatMap((photo) => {
      const ocrRecord = ocrRecords[photo.id];

      if (
        ocrRecord === undefined ||
        !ocrRecord.text
          .toLocaleLowerCase('ja-JP')
          .includes(normalizedQuery)
      ) {
        return [];
      }

      return [{
        photo,
        preview: createPreview(
          ocrRecord.text,
          normalizedQuery
        ),
      }];
    })
    .slice(0, limit);
};
