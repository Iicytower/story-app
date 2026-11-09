import type { ValidationError } from "@/lib/action-result";
import type { CoverScores } from "@/lib/models/cover";

export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 900;
// What the browser accepts before cropping and scaling.
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
// The scaled WebP sent to the action; also the classifier's limit.
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const COVERS_PER_ACCOUNT = 10;

const MB = 1024 * 1024;

export function coversMaxTotalBytes(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = Number(env.COVERS_MAX_TOTAL_MB);
  return (Number.isFinite(value) && value > 0 ? value : 200) * MB;
}

export function coverAdultThreshold(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = Number(env.COVERS_ADULT_THRESHOLD);
  return Number.isFinite(value) && value > 0 && value < 1 ? value : 0.5;
}

export function isAdultScores(scores: CoverScores, threshold: number) {
  return scores.nsfw > threshold || scores.nsfl > threshold;
}

// The declared type is the client's word; the bytes decide.
export function isWebp(bytes: Uint8Array): boolean {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  return bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((byte, index) => bytes[index] === byte);
}

// The browser sends WebP, or JPEG where canvas cannot encode WebP; the filter re-encodes both.
export function validateUpload(
  bytes: Uint8Array,
): ValidationError | { ok: true } {
  if (!isWebp(bytes) && !isJpeg(bytes) && !isPng(bytes)) {
    return { ok: false, error: "INVALID_INPUT", key: "coverInvalid" };
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "TOO_LARGE", key: "coverTooLarge" };
  }
  return { ok: true };
}

// Tries after the one at upload, counted from the upload (D68); then the cover is dropped.
export const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 24 * 60 * 60_000];

export function nextAttemptAt(uploadedAt: Date, failed: number): Date | null {
  const delay = RETRY_DELAYS_MS[failed - 1];
  return delay === undefined ? null : new Date(uploadedAt.getTime() + delay);
}

export interface Classification {
  model: string;
  scores: CoverScores;
  image: Buffer;
}

const isScore = (value: unknown) =>
  typeof value === "number" && value >= 0 && value <= 1;

export function parseClassification(value: unknown): Classification | null {
  if (typeof value !== "object" || value === null) return null;
  const { model, scores, image } = value as Record<string, unknown>;
  if (typeof model !== "string" || typeof image !== "string") return null;
  if (typeof scores !== "object" || scores === null) return null;
  const { nsfl, nsfw, sfw } = scores as Record<string, unknown>;
  if (!isScore(nsfl) || !isScore(nsfw) || !isScore(sfw)) return null;
  const bytes = Buffer.from(image, "base64");
  if (!isWebp(bytes) || bytes.length > MAX_UPLOAD_BYTES) return null;
  return {
    model,
    scores: { nsfl, nsfw, sfw } as CoverScores,
    image: bytes,
  };
}
