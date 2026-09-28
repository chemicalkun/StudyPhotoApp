import type { PhotoOcrRecords } from '@/types/photo-ocr';
import type { PhotoRecord } from '@/types/photo';


export type PhotoTextSearchResult = {
  photo: PhotoRecord;
  preview: string;
};


export const normalizeStudySearchText = (
  value: string
) => value
  .normalize('NFKC')
  .toLocaleLowerCase('ja-JP')
  .replace(/\s+/g, '');


export const getStudySearchTerms = (
  query: string
) => query
  .normalize('NFKC')
  .toLocaleLowerCase('ja-JP')
  .trim()
  .split(/\s+/)
  .map(normalizeStudySearchText)
  .filter(Boolean);


export const matchesStudySearchText = (
  text: string,
  query: string
) => {
  const searchTerms = getStudySearchTerms(query);

  if (searchTerms.length === 0) {
    return true;
  }

  const normalizedText = normalizeStudySearchText(text);

  return searchTerms.every((searchTerm) =>
    normalizedText.includes(searchTerm)
  );
};


const createNormalizedIndex = (text: string) => {
  let normalizedText = '';
  const sourceIndexes: number[] = [];
  let sourceIndex = 0;

  for (const character of text) {
    const normalizedCharacter =
      normalizeStudySearchText(character);

    normalizedText += normalizedCharacter;
    sourceIndexes.push(
      ...Array.from(normalizedCharacter).map(
        () => sourceIndex
      )
    );
    sourceIndex += character.length;
  }

  return { normalizedText, sourceIndexes };
};


const createPreview = (
  text: string,
  searchTerms: string[]
) => {
  const flattenedText = text.replace(/\s+/g, ' ').trim();
  const { normalizedText, sourceIndexes } =
    createNormalizedIndex(flattenedText);
  const firstMatch = searchTerms
    .map((searchTerm) => ({
      searchTerm,
      index: normalizedText.indexOf(searchTerm),
    }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  if (firstMatch === undefined || flattenedText.length <= 100) {
    return flattenedText;
  }

  const matchIndex = firstMatch.index;
  const matchSourceStart =
    sourceIndexes[matchIndex] ?? 0;
  const nextSourceIndex =
    sourceIndexes[
      matchIndex + firstMatch.searchTerm.length
    ];
  const matchSourceEnd = nextSourceIndex ??
    flattenedText.length;
  const start = Math.max(0, matchSourceStart - 35);
  const end = Math.min(
    flattenedText.length,
    matchSourceEnd + 55
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
  const searchTerms = getStudySearchTerms(query);

  if (searchTerms.length === 0 || limit <= 0) {
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
        !matchesStudySearchText(ocrRecord.text, query)
      ) {
        return [];
      }

      return [{
        photo,
        preview: createPreview(
          ocrRecord.text,
          searchTerms
        ),
      }];
    })
    .slice(0, limit);
};
