const exifDateKeys = [
  'DateTimeOriginal',
  'DateTimeDigitized',
  'DateTime',
] as const;


const parseExifDateString = (
  savedDate: string
): Date | null => {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(
    savedDate.trim()
  );

  if (match === null) {
    const parsedDate = new Date(savedDate);

    return Number.isNaN(parsedDate.getTime())
      ? null
      : parsedDate;
  }

  const [, year, month, day, hour, minute, second] =
    match.map(Number);
  const parsedDate = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day &&
    parsedDate.getHours() === hour &&
    parsedDate.getMinutes() === minute &&
    parsedDate.getSeconds() === second
  )
    ? parsedDate
    : null;
};


export const getExifTakenAt = (
  exif: Record<string, unknown> | null | undefined
): Date | null => {
  if (exif === null || exif === undefined) {
    return null;
  }

  for (const key of exifDateKeys) {
    const savedDate = exif[key];

    if (typeof savedDate !== 'string') {
      continue;
    }

    const parsedDate = parseExifDateString(savedDate);

    if (parsedDate !== null) {
      return parsedDate;
    }
  }

  return null;
};
