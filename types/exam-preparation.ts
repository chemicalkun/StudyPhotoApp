import type {
  LectureSummaryRecord,
} from '@/types/lecture-summary';


export const examPreparationSourceLimit = 6_000;


export const buildExamPreparationSource = (
  summaries: LectureSummaryRecord[],
  maxLength = examPreparationSourceLimit
) => {
  if (summaries.length === 0 || maxLength <= 0) {
    return '';
  }

  const sortedSummaries = [...summaries].sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey)
  );
  const headers = sortedSummaries.map(
    (summary, index) =>
      `第${index + 1}回（${summary.dateKey}）\n`
  );
  const separatorLength =
    Math.max(0, sortedSummaries.length - 1) * 2;
  const contentBudget = Math.max(
    0,
    maxLength -
      headers.reduce(
        (total, header) => total + header.length,
        0
      ) -
      separatorLength
  );
  const perSummaryLimit = Math.floor(
    contentBudget / sortedSummaries.length
  );

  return sortedSummaries
    .map((summary, index) => {
      return (
        headers[index] +
        summary.text.slice(0, perSummaryLimit)
      );
    })
    .join('\n\n')
    .slice(0, maxLength);
};
