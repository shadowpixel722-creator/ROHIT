import "server-only";
import sharp from "sharp";
import { UserError } from "./action";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Re-encodes a photo (any orientation, any size) to a plain JPEG, which drops every bit of metadata (GPS, author, device). */
export async function cleanPhoto(dataUrl: string) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new UserError("That picture couldn't be read. Try a JPEG or PNG photo.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_PHOTO_BYTES) throw new UserError("That picture is too big.");
  try { return await sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(); }
  catch { throw new UserError("That picture couldn't be read. Try another one."); }
}
