export const normalizeSubjectName = (
  subject: string
) => subject.trim().normalize('NFKC');


export const areSameSubjectNames = (
  firstSubject: string,
  secondSubject: string
) => normalizeSubjectName(firstSubject) ===
  normalizeSubjectName(secondSubject);


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
