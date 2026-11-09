import { COVER_HEIGHT, COVER_WIDTH } from "@/lib/covers/covers";
import type { ExportFormatId } from "./formats";

export const COVER_FORMATS: ExportFormatId[] = ["epub", "docx", "pdf"];

// Browser only: the stored WebP becomes a JPEG, which every title-page generator takes.
export async function loadCoverJpeg(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cover: ${response.status}`);
  const image = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  canvas.getContext("2d")!.drawImage(image, 0, 0, COVER_WIDTH, COVER_HEIGHT);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  return new Uint8Array(await blob!.arrayBuffer());
}
