import { PeriodNumber, periodNumbers } from '@/utils/period-times';


export const timetableDays = [
  '月',
  '火',
  '水',
  '木',
  '金',
] as const;

export type TimetableDay =
  (typeof timetableDays)[number];

export type PositionedTextBlock = {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type TimetableCandidate = {
  day: TimetableDay;
  period: PeriodNumber;
  subject: string;
  confidence: number;
};

export type TimetableRecognitionResult = {
  candidates: TimetableCandidate[];
  detectedDays: TimetableDay[];
  detectedPeriods: PeriodNumber[];
  warning: string | null;
};

type DayAnchor = {
  day: TimetableDay;
  x: number;
  y: number;
  blockIndex: number;
};

type PeriodAnchor = {
  period: PeriodNumber;
  x: number;
  y: number;
  blockIndex: number;
};

type AssignedBlock = {
  day: TimetableDay;
  period: PeriodNumber;
  block: PositionedTextBlock;
};


const compactText = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\s|｜/・,，、]+/g, '');


const isJapaneseCharacter = (value: string) =>
  /[\u3040-\u30ff\u3400-\u9fff]/.test(value);


export const normalizeTimetableText = (text: string) => {
  const parts = text.trim().split(/\s+/).filter(Boolean);

  return parts.reduce((result, part) => {
    if (result === '') {
      return part;
    }

    const previousCharacter = result.slice(-1);
    const nextCharacter = part[0];
    const separator =
      isJapaneseCharacter(previousCharacter) ||
      isJapaneseCharacter(nextCharacter)
        ? ''
        : ' ';

    return `${result}${separator}${part}`;
  }, '');
};


const isTimetableDay = (
  value: string
): value is TimetableDay =>
  timetableDays.some((day) => day === value);


const isPeriodNumber = (
  value: number
): value is PeriodNumber =>
  periodNumbers.some((period) => period === value);


const getCenterX = (block: PositionedTextBlock) =>
  block.boundingBox.x + block.boundingBox.width / 2;


const getCenterY = (block: PositionedTextBlock) =>
  block.boundingBox.y + block.boundingBox.height / 2;


const getDayAnchors = (
  block: PositionedTextBlock,
  blockIndex: number
): DayAnchor[] => {
  const text = compactText(block.text);
  const matches = text.match(
    /(?:月|火|水|木|金)(?:曜日|曜)?/g
  );

  if (
    matches === null ||
    matches.join('') !== text ||
    matches.length === 0
  ) {
    return [];
  }

  return matches.flatMap((match, index) => {
    const day = match[0];

    if (!isTimetableDay(day)) {
      return [];
    }

    return [{
      day,
      x:
        block.boundingBox.x +
        block.boundingBox.width *
          ((index + 0.5) / matches.length),
      y: getCenterY(block),
      blockIndex,
    }];
  });
};


const getPeriodAnchor = (
  block: PositionedTextBlock,
  blockIndex: number
): PeriodAnchor | null => {
  const match = /^([1-5])(?:時限|限)?$/.exec(
    compactText(block.text)
  );

  if (match === null) {
    return null;
  }

  const period = Number(match[1]);

  if (!isPeriodNumber(period)) {
    return null;
  }

  return {
    period,
    x: getCenterX(block),
    y: getCenterY(block),
    blockIndex,
  };
};


const selectDayAnchors = (
  anchors: DayAnchor[]
): DayAnchor[] =>
  timetableDays.flatMap((day) => {
    const candidates = anchors
      .filter((anchor) => anchor.day === day)
      .sort((a, b) => b.y - a.y);

    return candidates.length > 0 ? [candidates[0]] : [];
  });


const selectPeriodAnchors = (
  anchors: PeriodAnchor[]
): PeriodAnchor[] =>
  periodNumbers.flatMap((period) => {
    const candidates = anchors
      .filter((anchor) => anchor.period === period)
      .sort((a, b) => a.x - b.x);

    return candidates.length > 0 ? [candidates[0]] : [];
  });


const findNearestAnchor = <T extends { x: number; y: number }>(
  anchors: T[],
  value: number,
  axis: 'x' | 'y'
) =>
  anchors.reduce((nearest, anchor) =>
    Math.abs(anchor[axis] - value) <
    Math.abs(nearest[axis] - value)
      ? anchor
      : nearest
  );


const isInsideAnchorRange = (
  values: number[],
  value: number
) => {
  const sortedValues = [...values].sort((a, b) => a - b);

  if (sortedValues.length < 2) {
    return false;
  }

  const firstGap = sortedValues[1] - sortedValues[0];
  const lastGap =
    sortedValues[sortedValues.length - 1] -
    sortedValues[sortedValues.length - 2];
  const minimum = sortedValues[0] - firstGap / 2;
  const maximum =
    sortedValues[sortedValues.length - 1] + lastGap / 2;

  return value >= minimum && value <= maximum;
};


const getWarning = (
  dayAnchors: DayAnchor[],
  periodAnchors: PeriodAnchor[],
  candidateCount: number
) => {
  if (dayAnchors.length < 2) {
    return '曜日の見出しを十分に検出できませんでした。';
  }

  if (periodAnchors.length < 2) {
    return '時限の見出しを十分に検出できませんでした。';
  }

  if (candidateCount === 0) {
    return '曜日と時限は検出できましたが、科目候補を見つけられませんでした。';
  }

  return null;
};


export const parseTimetableCandidates = (
  blocks: PositionedTextBlock[]
): TimetableRecognitionResult => {
  const allDayAnchors = blocks.flatMap(
    (block, index) => getDayAnchors(block, index)
  );
  const allPeriodAnchors = blocks.flatMap(
    (block, index) => {
      const anchor = getPeriodAnchor(block, index);

      return anchor === null ? [] : [anchor];
    }
  );
  const dayAnchors = selectDayAnchors(allDayAnchors);
  const periodAnchors = selectPeriodAnchors(
    allPeriodAnchors
  );
  const detectedDays = dayAnchors.map(
    (anchor) => anchor.day
  );
  const detectedPeriods = periodAnchors.map(
    (anchor) => anchor.period
  );

  if (
    dayAnchors.length < 2 ||
    periodAnchors.length < 2
  ) {
    return {
      candidates: [],
      detectedDays,
      detectedPeriods,
      warning: getWarning(dayAnchors, periodAnchors, 0),
    };
  }

  const headerBlockIndexes = new Set([
    ...dayAnchors.map((anchor) => anchor.blockIndex),
    ...periodAnchors.map((anchor) => anchor.blockIndex),
  ]);
  const dayXs = dayAnchors.map((anchor) => anchor.x);
  const periodYs = periodAnchors.map((anchor) => anchor.y);
  const assignedBlocks: AssignedBlock[] = [];

  blocks.forEach((block, blockIndex) => {
    const subject = block.text.trim();

    if (
      subject === '' ||
      headerBlockIndexes.has(blockIndex)
    ) {
      return;
    }

    const x = getCenterX(block);
    const y = getCenterY(block);

    if (
      !isInsideAnchorRange(dayXs, x) ||
      !isInsideAnchorRange(periodYs, y)
    ) {
      return;
    }

    const dayAnchor = findNearestAnchor(
      dayAnchors,
      x,
      'x'
    );
    const periodAnchor = findNearestAnchor(
      periodAnchors,
      y,
      'y'
    );

    assignedBlocks.push({
      day: dayAnchor.day,
      period: periodAnchor.period,
      block,
    });
  });

  const groupedBlocks = new Map<string, AssignedBlock[]>();

  assignedBlocks.forEach((assignedBlock) => {
    const key =
      `${assignedBlock.day}-${assignedBlock.period}`;
    const cellBlocks = groupedBlocks.get(key) ?? [];

    cellBlocks.push(assignedBlock);
    groupedBlocks.set(key, cellBlocks);
  });

  const candidates = Array.from(groupedBlocks.values())
    .map((cellBlocks): TimetableCandidate => {
      const sortedBlocks = [...cellBlocks].sort(
        (a, b) =>
          getCenterY(b.block) - getCenterY(a.block) ||
          getCenterX(a.block) - getCenterX(b.block)
      );
      const confidence =
        sortedBlocks.reduce(
          (sum, item) => sum + item.block.confidence,
          0
        ) / sortedBlocks.length;

      return {
        day: sortedBlocks[0].day,
        period: sortedBlocks[0].period,
        subject: normalizeTimetableText(
          sortedBlocks
            .map((item) => item.block.text)
            .join(' ')
        ),
        confidence,
      };
    })
    .sort(
      (a, b) =>
        a.period - b.period ||
        timetableDays.indexOf(a.day) -
          timetableDays.indexOf(b.day)
    );

  return {
    candidates,
    detectedDays,
    detectedPeriods,
    warning: getWarning(
      dayAnchors,
      periodAnchors,
      candidates.length
    ),
  };
};
