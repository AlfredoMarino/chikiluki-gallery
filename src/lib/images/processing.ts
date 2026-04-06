import sharp from "sharp";
import { encode } from "blurhash";

interface ProcessedImage {
  thumbnail: Buffer;
  medium: Buffer;
  width: number;
  height: number;
  orientation: "landscape" | "portrait" | "square";
  blurhash: string;
  thumbBase64: string;
}

/**
 * Process an uploaded image: extract metadata, generate thumbnail,
 * medium size, blurhash, and tiny base64 thumbnail.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const orientation: ProcessedImage["orientation"] =
    width > height ? "landscape" : width < height ? "portrait" : "square";

  // Generate thumbnail (300px on longest side)
  const thumbnail = await sharp(buffer)
    .resize(300, 300, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Generate medium (800px on longest side)
  const medium = await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Generate blurhash from a small version of the image
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blurhash = encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    4,
    3
  );

  // Tiny base64 thumbnail (~2KB) for instant loading
  const tinyThumb = await sharp(buffer)
    .resize(40, 40, { fit: "inside" })
    .jpeg({ quality: 60 })
    .toBuffer();

  const thumbBase64 = `data:image/jpeg;base64,${tinyThumb.toString("base64")}`;

  return {
    thumbnail,
    medium,
    width,
    height,
    orientation,
    blurhash,
    thumbBase64,
  };
}

/**
 * Calculate SHA-256 hash of a file buffer.
 */
export async function calculateFileHash(buffer: Buffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(buffer)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
