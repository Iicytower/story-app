import { COVER_SIZE, type ImageSize } from "./covers";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_ZOOM = 4;

// The part of the image with the ratio of `size` (2:3 for a cover): the largest one at zoom 1,
// centred and moved by `center` (source pixels from the image centre), kept inside the image.
export function cropRect(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  center: { x: number; y: number },
  size: ImageSize = COVER_SIZE,
): CropRect {
  const ratio = size.width / size.height;
  const base =
    imageWidth / imageHeight > ratio
      ? { width: imageHeight * ratio, height: imageHeight }
      : { width: imageWidth, height: imageWidth / ratio };
  const scale = Math.min(Math.max(zoom, 1), MAX_ZOOM);
  const width = base.width / scale;
  const height = base.height / scale;
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, 0), max);
  return {
    x: clamp(imageWidth / 2 + center.x - width / 2, imageWidth - width),
    y: clamp(imageHeight / 2 + center.y - height / 2, imageHeight - height),
    width,
    height,
  };
}

// The centre offset that cropRect actually used, so dragging past an edge does not build up.
export function clampedCenter(
  imageWidth: number,
  imageHeight: number,
  rect: CropRect,
) {
  return {
    x: rect.x + rect.width / 2 - imageWidth / 2,
    y: rect.y + rect.height / 2 - imageHeight / 2,
  };
}
