export type PhotoRecord = {
  id: string;
  uri: string;
  takenAt: string;
  day: string;
  period: number | null;
  subject: string | null;
};


export const isUnclassifiedPhoto = (
  photo: PhotoRecord
) =>
  photo.subject === null ||
  photo.subject.trim() === '' ||
  photo.subject === '未分類';


export const groupPhotosBySubject = (
  photos: PhotoRecord[]
) =>
  photos.reduce<Record<string, PhotoRecord[]>>(
    (groups, photo) => {
      if (isUnclassifiedPhoto(photo)) {
        return groups;
      }

      const subject = photo.subject;

      if (subject === null) {
        return groups;
      }

      groups[subject] = [
        ...(groups[subject] ?? []),
        photo,
      ];

      return groups;
    },
    {}
  );


export const isPhotoRecord = (
  value: unknown
): value is PhotoRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const photo = value as Partial<PhotoRecord>;

  return (
    typeof photo.id === 'string' &&
    typeof photo.uri === 'string' &&
    typeof photo.takenAt === 'string' &&
    typeof photo.day === 'string' &&
    (typeof photo.period === 'number' ||
      photo.period === null) &&
    (typeof photo.subject === 'string' ||
      photo.subject === null)
  );
};


export const parsePhotoRecords = (
  savedPhotos: string
): PhotoRecord[] => {
  const parsedPhotos: unknown = JSON.parse(savedPhotos);

  if (
    !Array.isArray(parsedPhotos) ||
    !parsedPhotos.every(isPhotoRecord)
  ) {
    throw new Error('photosの形式が不正です');
  }

  return parsedPhotos;
};
