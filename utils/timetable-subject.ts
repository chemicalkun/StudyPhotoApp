export const normalizeSubjectName = (
  subject: string
) => subject.trim().normalize('NFKC');


export const areSameSubjectNames = (
  firstSubject: string,
  secondSubject: string
) => normalizeSubjectName(firstSubject) ===
  normalizeSubjectName(secondSubject);


export const getUniqueTimetableSubjects = (
  timetable: Record<string, string> | null
) => {
  if (timetable === null) {
    return [];
  }

  const subjectsByNormalizedName = new Map<
    string,
    string
  >();

  Object.values(timetable).forEach((subject) => {
    const trimmedSubject = subject.trim();

    if (trimmedSubject === '') {
      return;
    }

    const normalizedSubject =
      normalizeSubjectName(trimmedSubject);

    if (!subjectsByNormalizedName.has(normalizedSubject)) {
      subjectsByNormalizedName.set(
        normalizedSubject,
        trimmedSubject
      );
    }
  });

  return [...subjectsByNormalizedName.values()].sort(
    (firstSubject, secondSubject) =>
      firstSubject.localeCompare(secondSubject, 'ja')
  );
};


export type TimetableSubjectRename = {
  previousSubject: string;
  nextSubject: string;
};


export const getTimetableSubjectRenames = (
  previousTimetable: Record<string, string>,
  nextTimetable: Record<string, string>
): TimetableSubjectRename[] => {
  const previousSubjects =
    getUniqueTimetableSubjects(previousTimetable);
  const nextSubjects =
    getUniqueTimetableSubjects(nextTimetable);

  return previousSubjects.flatMap((previousSubject) => {
    if (
      nextSubjects.some((subject) =>
        areSameSubjectNames(subject, previousSubject)
      )
    ) {
      return [];
    }

    const replacementSubjects = Object.entries(
      previousTimetable
    ).flatMap(([key, subject]) => {
      if (!areSameSubjectNames(subject, previousSubject)) {
        return [];
      }

      const replacement = nextTimetable[key]?.trim();

      return replacement ? [replacement] : [];
    });
    const uniqueReplacements = [
      ...new Map(
        replacementSubjects.map((subject) => [
          normalizeSubjectName(subject),
          subject,
        ])
      ).values(),
    ];

    if (uniqueReplacements.length !== 1) {
      return [];
    }

    const nextSubject = uniqueReplacements[0];
    const nextSubjectAlreadyExisted = previousSubjects.some(
      (subject) =>
        !areSameSubjectNames(subject, previousSubject) &&
        areSameSubjectNames(subject, nextSubject)
    );

    if (nextSubjectAlreadyExisted) {
      return [];
    }

    return [{ previousSubject, nextSubject }];
  });
};


export const renameTimetableSubject = (
  timetable: Record<string, string>,
  previousSubject: string,
  nextSubject: string
) => Object.fromEntries(
  Object.entries(timetable).map(
    ([timetableKey, subject]) => [
      timetableKey,
      areSameSubjectNames(subject, previousSubject)
        ? nextSubject
        : subject,
    ]
  )
);
