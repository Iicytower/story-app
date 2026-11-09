import { COVER_HEIGHT, COVER_WIDTH } from "./covers";
import { cropRect, type CropRect } from "./crop";

// Browser only. Canvas re-encoding also drops EXIF and GPS data; Safari encodes no WebP, so
// JPEG is the fallback (the filter re-encodes it to WebP).
export async function renderCover(
  image: ImageBitmap,
  rect: CropRect = cropRect(image.width, image.height, 1, { x: 0, y: 0 }),
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  canvas
    .getContext("2d")!
    .drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      COVER_WIDTH,
      COVER_HEIGHT,
    );
  const blob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await blob("image/webp");
  return webp?.type === "image/webp" ? webp : (await blob("image/jpeg"))!;
}
