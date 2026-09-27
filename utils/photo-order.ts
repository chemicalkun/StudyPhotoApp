import type { PhotoRecord } from '@/types/photo';


const getTakenAtTimestamp = (photo: PhotoRecord) => {
  const timestamp = new Date(photo.takenAt).getTime();

  return Number.isNaN(timestamp)
    ? 8_000_000_000_000_000
    : timestamp;
};


export const comparePhotosByLectureOrder = (
  firstPhoto: PhotoRecord,
  secondPhoto: PhotoRecord
) => {
  const firstTimestamp = getTakenAtTimestamp(firstPhoto);
  const secondTimestamp = getTakenAtTimestamp(secondPhoto);
  const firstDate = new Date(firstTimestamp);
  const secondDate = new Date(secondTimestamp);
  const dateDifference =
    firstDate.getFullYear() - secondDate.getFullYear() ||
    firstDate.getMonth() - secondDate.getMonth() ||
    firstDate.getDate() - secondDate.getDate();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  const firstOrder = firstPhoto.lectureOrder;
  const secondOrder = secondPhoto.lectureOrder;

  if (
    firstOrder !== undefined ||
    secondOrder !== undefined
  ) {
    if (firstOrder === undefined) {
      return 1;
    }

    if (secondOrder === undefined) {
      return -1;
    }

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
  }

  return (
    firstTimestamp - secondTimestamp ||
    firstPhoto.id.localeCompare(secondPhoto.id)
  );
};


export const applyLecturePhotoOrder = (
  photos: PhotoRecord[],
  orderedPhotoIds: string[]
) => {
  const uniquePhotoIds = new Set(orderedPhotoIds);

  if (uniquePhotoIds.size !== orderedPhotoIds.length) {
    throw new Error('写真の並び順が不正です');
  }

  const orderByPhotoId = new Map(
    orderedPhotoIds.map((photoId, index) => [
      photoId,
      index,
    ])
  );

  if (
    orderedPhotoIds.some(
      (photoId) =>
        !photos.some((photo) => photo.id === photoId)
    )
  ) {
    throw new Error('並び替える写真が見つかりません');
  }

  return photos.map((photo) => {
    const lectureOrder = orderByPhotoId.get(photo.id);

    return lectureOrder === undefined
      ? photo
      : { ...photo, lectureOrder };
  });
};
