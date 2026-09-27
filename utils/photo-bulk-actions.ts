import type { PhotoRecord } from '@/types/photo';
import { assignPhotoToLecture } from '@/utils/photo-lecture';


export const updateSelectedPhotoSubjects = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>,
  subject: string | null
) => photos.map((photo) =>
  selectedPhotoIds.has(photo.id)
    ? { ...photo, subject }
    : photo
);


export const moveSelectedPhotosToLecture = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>,
  targetLecturePhoto: PhotoRecord
) => photos.map((photo) =>
  selectedPhotoIds.has(photo.id)
    ? assignPhotoToLecture(photo, targetLecturePhoto)
    : photo
);


export const removeSelectedPhotos = (
  photos: PhotoRecord[],
  selectedPhotoIds: ReadonlySet<string>
) => photos.filter(
  (photo) => !selectedPhotoIds.has(photo.id)
);
