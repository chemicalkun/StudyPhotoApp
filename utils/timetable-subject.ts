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
