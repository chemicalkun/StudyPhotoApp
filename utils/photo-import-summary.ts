export const summarizePhotoClassifications = (
  classificationLabels: string[]
) => {
  const counts = new Map<string, number>();

  classificationLabels.forEach((label) => {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()].map(
    ([label, count]) => `${label}（${count}枚）`
  );
};
