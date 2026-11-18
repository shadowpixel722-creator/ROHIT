import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { deskew } from "./deskew";

/** Uploaded files live outside /public and are only served through authenticated routes. */
export const STORAGE_DIR = path.join(process.cwd(), "storage", "uploads");
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_NOTE = 20;

const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isWebp = (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
const isHeic = (b: Buffer) => b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|hevc|mif1|msf1)/.test(b.subarray(8, 12).toString("latin1"));

export class ImageError extends Error {}

/**
 * Validates and re-encodes a page photo:
 *  - only real JPEG/PNG/WEBP (checked by content, not file name)
 *  - rotated upright using the camera's orientation, then ALL metadata (EXIF, GPS, device) is dropped
 *  - downscaled to at most 2400 px and saved as WebP
 */
export async function processPageImage(bytes: Buffer, name: string) {
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageError(`“${name}” is larger than 10 MB.`);
  if (isHeic(bytes)) throw new ImageError(`“${name}” is an iPhone HEIC photo. Share it as JPEG, or set Camera → Formats → Most Compatible.`);
  if (!isJpeg(bytes) && !isPng(bytes) && !isWebp(bytes)) throw new ImageError(`“${name}” isn't a JPG, PNG or WEBP image.`);
  let upright: Buffer;
  try {
    // Camera orientation applied, then capped in size (metadata is dropped by every re-encode below).
    upright = await sharp(bytes, { limitInputPixels: 60_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new ImageError(`“${name}” couldn't be read as an image.`);
  }
  // Post-scan alignment: level small tilts automatically (skipped when unsure).
  const { data: level, angle } = await deskew(upright).catch(() => ({ data: upright, angle: 0 }));
  const { data, info } = await sharp(level).resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, size: data.length, straightenedBy: angle };
}

export async function saveClassImage(classroomId: string, data: Buffer) {
  const rel = path.join("classes", classroomId, `${randomUUID()}.webp`);
  await mkdir(path.dirname(path.join(STORAGE_DIR, rel)), { recursive: true });
  await writeFile(path.join(STORAGE_DIR, rel), data);
  return rel;
}

function safeResolve(rel: string) {
  const full = path.resolve(STORAGE_DIR, rel);
  if (!full.startsWith(STORAGE_DIR + path.sep)) throw new Error("Invalid path");
  return full;
}

export const readUpload = (rel: string) => readFile(safeResolve(rel));
export const removeUpload = (rel: string) => unlink(safeResolve(rel)).catch(() => {});
export const removeUploads = (rels: string[]) => Promise.all(rels.map(removeUpload));
export const removeClassStorage = (classroomId: string) => rm(safeResolve(path.join("classes", classroomId)), { recursive: true, force: true });

/** Rotates a stored page by 90° steps (teacher fix after upload). Returns the new size. */
export async function rotateStoredImage(rel: string, degrees: 90 | 180 | 270) {
  const { data, info } = await sharp(await readUpload(rel)).rotate(degrees).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  await writeFile(safeResolve(rel), data);
  return { width: info.width, height: info.height, size: data.length };
}

/** Saves a checked attachment privately in the class's folder (removed with the class). */
export async function saveClassFile(classroomId: string, data: Uint8Array, ext: string) {
  const rel = path.join("classes", classroomId, `att-${randomUUID()}.${ext.replace(/[^a-z0-9]/g, "")}`);
  await mkdir(path.dirname(path.join(STORAGE_DIR, rel)), { recursive: true });
  await writeFile(path.join(STORAGE_DIR, rel), data);
  return rel;
}
