export const getUnansweredItemIndexes = (
  itemCount: number,
  assessments: Record<string, 'known' | 'review'>
) =>
  Array.from(
    { length: itemCount },
    (_, index) => index
  ).filter(
    (index) => assessments[String(index)] === undefined
  );
