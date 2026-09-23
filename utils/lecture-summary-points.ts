const reviewPointHeadings = new Set([
  '重要語句',
  '重要用語',
  '復習ポイント',
  '復習のポイント',
  '覚えること・理解すること',
]);


const fallbackPointHeadings = new Set([
  '要点',
  'この回の要点',
]);


type SummaryHeading = {
  heading: string;
  trailingText: string;
};


const parseSummaryHeading = (
  line: string
): SummaryHeading | null => {
  const normalizedLine = line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*{1,2}/, '')
    .replace(/\*{1,2}$/, '')
    .trim();
  const bracketHeading = normalizedLine.match(
    /^【([^】]+)】\s*(?:[:：-]\s*)?(.*)$/
  );

  if (bracketHeading !== null) {
    return {
      heading: bracketHeading[1].trim(),
      trailingText: bracketHeading[2].trim(),
    };
  }

  const plainHeading = normalizedLine
    .replace(/[:：]\s*$/, '')
    .trim();

  if (
    reviewPointHeadings.has(plainHeading) ||
    fallbackPointHeadings.has(plainHeading)
  ) {
    return {
      heading: plainHeading,
      trailingText: '',
    };
  }

  return null;
};


const normalizeReviewPoint = (line: string) =>
  line
    .replace(/^\s*(?:[-*•・]|・|\d+[.)）])\s*/, '')
    .trim();


export const extractLectureSummaryReviewPoints = (
  summaryText: string,
  limit = 6
): string[] => {
  if (limit <= 0) {
    return [];
  }

  const reviewPoints: string[] = [];
  const fallbackPoints: string[] = [];
  let targetPoints: string[] | null = null;

  const addPoint = (line: string) => {
    if (targetPoints === null) {
      return;
    }

    const point = normalizeReviewPoint(line);

    if (
      point !== '' &&
      !targetPoints.includes(point) &&
      targetPoints.length < limit
    ) {
      targetPoints.push(point);
    }
  };

  summaryText.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    const heading = parseSummaryHeading(trimmedLine);

    if (heading !== null) {
      if (reviewPointHeadings.has(heading.heading)) {
        targetPoints = reviewPoints;
      } else if (fallbackPointHeadings.has(heading.heading)) {
        targetPoints = fallbackPoints;
      } else {
        targetPoints = null;
      }

      addPoint(heading.trailingText);
      return;
    }

    if (trimmedLine === '') {
      return;
    }

    addPoint(trimmedLine);
  });

  return reviewPoints.length > 0
    ? reviewPoints
    : fallbackPoints;
};
