"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  type ImageSize,
  INPUT_TYPES,
  MAX_INPUT_BYTES,
} from "@/lib/covers/covers";
import { clampedCenter, cropRect, MAX_ZOOM } from "@/lib/covers/crop";
import { renderCover } from "@/lib/covers/encode";

// The crop frame of the cover dialog (D68), also for avatars (task 70).
export function useImageCrop(size: ImageSize) {
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, y: 0 });

  const rectFor = (at: { x: number; y: number }) =>
    cropRect(image!.width, image!.height, zoom, at, size);

  return {
    size,
    image,
    zoom,
    center,
    setZoom,
    setCenter,
    rectFor,
    clear() {
      setImage(null);
      setZoom(1);
      setCenter({ x: 0, y: 0 });
    },
    // False for a file the browser should not or cannot decode.
    async choose(file: File): Promise<boolean> {
      if (!INPUT_TYPES.includes(file.type) || file.size > MAX_INPUT_BYTES) {
        return false;
      }
      try {
        setImage(await createImageBitmap(file));
        setZoom(1);
        setCenter({ x: 0, y: 0 });
        return true;
      } catch {
        return false;
      }
    },
    render(): Promise<Blob> {
      return renderCover(image!, rectFor(center), size);
    },
  };
}

export type ImageCrop = ReturnType<typeof useImageCrop>;

export function CropFrame({
  crop,
  scale,
  frameLabel,
  zoomLabel,
}: {
  crop: ImageCrop;
  scale: number;
  frameLabel: string;
  zoomLabel: string;
}) {
  const { image, zoom, center, size, rectFor, setCenter, setZoom } = crop;
  const preview = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = preview.current;
    if (!image || !canvas) return;
    const rect = cropRect(image.width, image.height, zoom, center, size);
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
        canvas.width,
        canvas.height,
      );
  }, [image, zoom, center, size]);

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !image) return;
    const rect = rectFor(center);
    // Screen pixels to source pixels: the frame shows rect.width over the canvas width.
    const factor = rect.width / event.currentTarget.clientWidth;
    const moved = {
      x: center.x - (event.clientX - drag.current.x) * factor,
      y: center.y - (event.clientY - drag.current.y) * factor,
    };
    drag.current = { x: event.clientX, y: event.clientY };
    setCenter(clampedCenter(image.width, image.height, rectFor(moved)));
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={preview}
        width={size.width * scale}
        height={size.height * scale}
        aria-label={frameLabel}
        role="img"
        className="cursor-move touch-none rounded-md border"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
      />
      <Label className="flex w-full items-center gap-3">
        {zoomLabel}
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="flex-1"
        />
      </Label>
    </div>
  );
}
