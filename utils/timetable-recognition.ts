import { PeriodNumber, periodNumbers } from '@/utils/period-times';


export const timetableDays = [
  '月',
  '火',
  '水',
  '木',
  '金',
  '土',
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

type HorizontalSlotAnchor = {
  slot: number;
  x: number;
  y: number;
  blockIndex: number;
};

type AssignedBlock = {
  day: TimetableDay;
  period: PeriodNumber;
  block: PositionedTextBlock;
};

type TimetableOrientation =
  | 'daysHorizontal'
  | 'periodsHorizontal';


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


export const deduplicatePositionedTextBlocks = <
  T extends PositionedTextBlock,
>(blocks: T[]): T[] =>
  blocks.filter((block, index) =>
    !blocks.slice(0, index).some((previousBlock) =>
      normalizeTimetableText(previousBlock.text) ===
        normalizeTimetableText(block.text) &&
      Math.abs(getCenterX(previousBlock) - getCenterX(block)) <
        0.004 &&
      Math.abs(getCenterY(previousBlock) - getCenterY(block)) <
        0.004
    )
  );


const getDayAnchors = (
  block: PositionedTextBlock,
  blockIndex: number
): DayAnchor[] => {
  const text = compactText(block.text);
  const matches = text.match(
    /(?:月|火|水|木|金|土)(?:曜日|曜)?/g
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

    const isVertical =
      block.boundingBox.height > block.boundingBox.width;

    return [{
      day,
      x: isVertical
        ? getCenterX(block)
        : block.boundingBox.x +
          block.boundingBox.width *
            ((index + 0.5) / matches.length),
      y: isVertical
        ? block.boundingBox.y +
          block.boundingBox.height *
            ((matches.length - index - 0.5) / matches.length)
        : getCenterY(block),
      blockIndex,
    }];
  });
};


const getPeriodAnchors = (
  block: PositionedTextBlock,
  blockIndex: number
): PeriodAnchor[] => {
  const text = compactText(block.text);
  const periodPattern = new RegExp(
    `(?:第)?([${periodNumbers.join('')}])(?:時限|限|コマ)?`,
    'g'
  );
  const matches = [...text.matchAll(periodPattern)];

  if (
    matches.length === 0 ||
    matches.map((match) => match[0]).join('') !== text
  ) {
    return [];
  }

  return matches.flatMap((match, index) => {
    const period = Number(match[1]);

    if (!isPeriodNumber(period)) {
      return [];
    }

    const isHorizontal =
      block.boundingBox.width >= block.boundingBox.height;

    return [{
      period,
      x: isHorizontal
        ? block.boundingBox.x +
          block.boundingBox.width *
            ((index + 0.5) / matches.length)
        : getCenterX(block),
      y: isHorizontal
        ? getCenterY(block)
        : block.boundingBox.y +
          block.boundingBox.height *
            ((matches.length - index - 0.5) / matches.length),
      blockIndex,
    }];
  });
};


const getHorizontalSlotAnchors = (
  block: PositionedTextBlock,
  blockIndex: number
): HorizontalSlotAnchor[] => {
  const normalizedText = block.text
    .normalize('NFKC')
    .replace(/(?:時限|限|コマ)/g, ' ');
  const numericParts = normalizedText.match(/\d+/g) ?? [];
  const nonNumericText = normalizedText
    .replace(/\d+/g, '')
    .replace(/[\s|｜/・,，、.．:：;；()（）\-ー~〜]+/g, '');

  if (
    numericParts.length === 0 ||
    nonNumericText !== '' ||
    (
      numericParts.length > 1 &&
      block.boundingBox.width < block.boundingBox.height
    )
  ) {
    return [];
  }

  return numericParts.flatMap((numericPart, index) => {
    const slot = Number(numericPart);

    if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
      return [];
    }

    return [{
      slot,
      x:
        block.boundingBox.x +
        block.boundingBox.width *
          ((index + 0.5) / numericParts.length),
      y: getCenterY(block),
      blockIndex,
    }];
  });
};


const selectDayAnchors = (
  anchors: DayAnchor[],
  orientation: TimetableOrientation
): DayAnchor[] =>
  timetableDays.flatMap((day) => {
    const candidates = anchors
      .filter((anchor) => anchor.day === day)
      .sort((a, b) =>
        orientation === 'daysHorizontal'
          ? b.y - a.y
          : a.x - b.x
      );

    return candidates.length > 0 ? [candidates[0]] : [];
  });


const selectPeriodAnchors = (
  anchors: PeriodAnchor[],
  orientation: TimetableOrientation
): PeriodAnchor[] =>
  periodNumbers.flatMap((period) => {
    const candidates = anchors
      .filter((anchor) => anchor.period === period)
      .sort((a, b) =>
        orientation === 'daysHorizontal'
          ? a.x - b.x
          : b.y - a.y
      );

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


const getAnchorSpan = <T extends { x: number; y: number }>(
  anchors: T[],
  axis: 'x' | 'y'
) => {
  const values = anchors.map((anchor) => anchor[axis]);

  return values.length === 0
    ? 0
    : Math.max(...values) - Math.min(...values);
};


const parseTimetableOrientation = (
  blocks: PositionedTextBlock[],
  allDayAnchors: DayAnchor[],
  allPeriodAnchors: PeriodAnchor[],
  orientation: TimetableOrientation
) => {
  const dayAnchors = selectDayAnchors(
    allDayAnchors,
    orientation
  );
  const periodAnchors = selectPeriodAnchors(
    allPeriodAnchors,
    orientation
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
      result: {
        candidates: [],
        detectedDays,
        detectedPeriods,
        warning: getWarning(dayAnchors, periodAnchors, 0),
      },
      score: dayAnchors.length + periodAnchors.length,
    };
  }

  const headerBlockIndexes = new Set([
    ...dayAnchors.map((anchor) => anchor.blockIndex),
    ...periodAnchors.map((anchor) => anchor.blockIndex),
  ]);
  const dayAxis = orientation === 'daysHorizontal'
    ? 'x'
    : 'y';
  const periodAxis = orientation === 'daysHorizontal'
    ? 'y'
    : 'x';
  const dayValues = dayAnchors.map(
    (anchor) => anchor[dayAxis]
  );
  const periodValues = periodAnchors.map(
    (anchor) => anchor[periodAxis]
  );
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
      !isInsideAnchorRange(
        dayValues,
        dayAxis === 'x' ? x : y
      ) ||
      !isInsideAnchorRange(
        periodValues,
        periodAxis === 'x' ? x : y
      )
    ) {
      return;
    }

    const dayAnchor = findNearestAnchor(
      dayAnchors,
      dayAxis === 'x' ? x : y,
      dayAxis
    );
    const periodAnchor = findNearestAnchor(
      periodAnchors,
      periodAxis === 'x' ? x : y,
      periodAxis
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
    result: {
      candidates,
      detectedDays,
      detectedPeriods,
      warning: getWarning(
        dayAnchors,
        periodAnchors,
        candidates.length
      ),
    },
    score:
      candidates.length * 100 +
      getAnchorSpan(dayAnchors, dayAxis) +
      getAnchorSpan(periodAnchors, periodAxis),
  };
};


const selectDensestHorizontalSlotRow = (
  anchors: HorizontalSlotAnchor[]
) => {
  if (anchors.length === 0) {
    return [];
  }

  return anchors
    .map((baseAnchor) =>
      anchors.filter(
        (anchor) => Math.abs(anchor.y - baseAnchor.y) <= 0.025
      )
    )
    .reduce((densestRow, row) =>
      row.length > densestRow.length ? row : densestRow
    )
    .sort((a, b) => a.x - b.x);
};


const inferDayAnchorsFromHorizontalSlots = (
  slotRow: HorizontalSlotAnchor[]
): DayAnchor[] => {
  const groupStarts = slotRow
    .filter((anchor) => anchor.slot === 1)
    .sort((a, b) => a.x - b.x);

  if (groupStarts.length < 2) {
    return [];
  }

  const validGroups = groupStarts.flatMap(
    (groupStart, index) => {
      const nextGroupStart = groupStarts[index + 1];
      const group = slotRow.filter(
        (anchor) =>
          anchor.x >= groupStart.x - 0.002 &&
          (
            nextGroupStart === undefined ||
            anchor.x < nextGroupStart.x - 0.002
          )
      );
      const distinctSlots = new Set(
        group.map((anchor) => anchor.slot)
      );

      return distinctSlots.size >= 4 &&
        getAnchorSpan(group, 'x') >= 0.025
        ? [group]
        : [];
    }
  ).slice(0, timetableDays.length);

  if (validGroups.length < 2) {
    return [];
  }

  return validGroups.map((group, index) => {
    const xValues = group.map((anchor) => anchor.x);
    const y = group.reduce(
      (sum, anchor) => sum + anchor.y,
      0
    ) / group.length;

    return {
      day: timetableDays[index],
      x: (Math.min(...xValues) + Math.max(...xValues)) / 2,
      y,
      blockIndex: -(index + 1),
    };
  });
};


const parseHorizontallyGroupedTimetable = (
  blocks: PositionedTextBlock[],
  allDayAnchors: DayAnchor[],
  allSlotAnchors: HorizontalSlotAnchor[]
) => {
  const recognizedDayAnchors = selectDayAnchors(
    allDayAnchors,
    'daysHorizontal'
  );
  const densestSlotRow = selectDensestHorizontalSlotRow(
    allSlotAnchors
  );
  const inferredDayAnchors =
    inferDayAnchorsFromHorizontalSlots(densestSlotRow);
  const dayAnchors = inferredDayAnchors.length >= 2
    ? inferredDayAnchors
    : recognizedDayAnchors;

  if (dayAnchors.length < 2) {
    return {
      result: {
        candidates: [],
        detectedDays: dayAnchors.map((anchor) => anchor.day),
        detectedPeriods: [],
        warning: '曜日の見出しを十分に検出できませんでした。',
      } satisfies TimetableRecognitionResult,
      score: -1,
    };
  }

  const headerY = dayAnchors.reduce(
    (sum, anchor) => sum + anchor.y,
    0
  ) / dayAnchors.length;
  const dayValues = dayAnchors.map((anchor) => anchor.x);
  const headerSlotAnchors = allSlotAnchors.filter(
    (anchor) =>
      Math.abs(anchor.y - headerY) <= 0.14 &&
      isInsideAnchorRange(dayValues, anchor.x)
  );
  const slotsByDay = new Map<
    TimetableDay,
    HorizontalSlotAnchor[]
  >();

  headerSlotAnchors.forEach((slotAnchor) => {
    const dayAnchor = findNearestAnchor(
      dayAnchors,
      slotAnchor.x,
      'x'
    );
    const currentSlots = slotsByDay.get(dayAnchor.day) ?? [];
    const isDuplicate = currentSlots.some(
      (currentSlot) =>
        currentSlot.slot === slotAnchor.slot &&
        Math.abs(currentSlot.x - slotAnchor.x) < 0.005
    );

    if (!isDuplicate) {
      currentSlots.push(slotAnchor);
      slotsByDay.set(dayAnchor.day, currentSlots);
    }
  });

  const usableDayAnchors = dayAnchors.filter((dayAnchor) => {
    const slots = slotsByDay.get(dayAnchor.day) ?? [];
    const distinctSlots = new Set(
      slots.map((slot) => slot.slot)
    );
    const slotSpan = getAnchorSpan(slots, 'x');

    return distinctSlots.size >= 4 && slotSpan >= 0.025;
  });

  if (usableDayAnchors.length < 2) {
    return {
      result: {
        candidates: [],
        detectedDays: usableDayAnchors.map(
          (anchor) => anchor.day
        ),
        detectedPeriods: [],
        warning: '横並びの時限番号を十分に検出できませんでした。',
      } satisfies TimetableRecognitionResult,
      score: -1,
    };
  }

  const usableDayValues = usableDayAnchors.map(
    (anchor) => anchor.x
  );
  const headerBlockIndexes = new Set([
    ...dayAnchors.map((anchor) => anchor.blockIndex),
    ...headerSlotAnchors.map((anchor) => anchor.blockIndex),
  ]);
  const assignedBlocks: AssignedBlock[] = [];

  blocks.forEach((block, blockIndex) => {
    const subject = block.text.trim();
    const x = getCenterX(block);
    const y = getCenterY(block);

    if (
      subject === '' ||
      headerBlockIndexes.has(blockIndex) ||
      y >= headerY - 0.002 ||
      !isInsideAnchorRange(usableDayValues, x)
    ) {
      return;
    }

    const dayAnchor = findNearestAnchor(
      usableDayAnchors,
      x,
      'x'
    );
    const daySlots = slotsByDay.get(dayAnchor.day) ?? [];

    if (daySlots.length === 0) {
      return;
    }

    const slotAnchor = findNearestAnchor(daySlots, x, 'x');
    const period = Math.ceil(slotAnchor.slot / 2);

    if (!isPeriodNumber(period)) {
      return;
    }

    assignedBlocks.push({
      day: dayAnchor.day,
      period,
      block,
    });
  });

  const groupedBlocks = new Map<string, AssignedBlock[]>();

  assignedBlocks.forEach((assignedBlock) => {
    const key = `${assignedBlock.day}-${assignedBlock.period}`;
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
      const confidence = sortedBlocks.reduce(
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
  const detectedPeriods = Array.from(new Set(
    usableDayAnchors.flatMap((dayAnchor) =>
      (slotsByDay.get(dayAnchor.day) ?? []).map(
        (slot) => Math.ceil(slot.slot / 2)
      )
    )
  ))
    .filter(isPeriodNumber)
    .sort((a, b) => a - b);

  return {
    result: {
      candidates,
      detectedDays: usableDayAnchors.map(
        (anchor) => anchor.day
      ),
      detectedPeriods,
      warning: candidates.length === 0
        ? '曜日と横並びの時限は検出できましたが、科目候補を見つけられませんでした。'
        : null,
    } satisfies TimetableRecognitionResult,
    score:
      10_000 +
      candidates.length * 100 +
      usableDayAnchors.length * 10 +
      detectedPeriods.length,
  };
};


export const parseTimetableCandidates = (
  blocks: PositionedTextBlock[]
): TimetableRecognitionResult => {
  const allDayAnchors = blocks.flatMap(
    (block, index) => getDayAnchors(block, index)
  );
  const allPeriodAnchors = blocks.flatMap(
    (block, index) => getPeriodAnchors(block, index)
  );
  const allHorizontalSlotAnchors = blocks.flatMap(
    (block, index) => getHorizontalSlotAnchors(block, index)
  );
  const daysHorizontalAttempt = parseTimetableOrientation(
    blocks,
    allDayAnchors,
    allPeriodAnchors,
    'daysHorizontal'
  );
  const periodsHorizontalAttempt = parseTimetableOrientation(
    blocks,
    allDayAnchors,
    allPeriodAnchors,
    'periodsHorizontal'
  );
  const horizontallyGroupedAttempt =
    parseHorizontallyGroupedTimetable(
      blocks,
      allDayAnchors,
      allHorizontalSlotAnchors
    );

  if (
    horizontallyGroupedAttempt.score >
      daysHorizontalAttempt.score &&
    horizontallyGroupedAttempt.score >
      periodsHorizontalAttempt.score
  ) {
    return horizontallyGroupedAttempt.result;
  }

  return periodsHorizontalAttempt.score >
    daysHorizontalAttempt.score
    ? periodsHorizontalAttempt.result
    : daysHorizontalAttempt.result;
};
