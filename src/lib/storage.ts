import path from 'path';
import fs from 'fs';
import { Storage, Bucket } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET;
let bucket: Bucket | null = null;

export async function initStorage(): Promise<void> {
  if (!GCS_BUCKET) return;
  try {
    bucket = new Storage().bucket(GCS_BUCKET);
  } catch (e) {
    console.error('Failed to initialize GCS client:', e);
  }
}

export const IS_GCS = !!GCS_BUCKET;

export function generateStoredName(originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
}

export async function saveFile(buffer: Buffer, storedName: string, mimeType: string): Promise<void> {
  if (!bucket) return;
  await bucket.file(storedName).save(buffer, { metadata: { contentType: mimeType } });
}

export function getReadStream(storedName: string, uploadsDir: string): NodeJS.ReadableStream {
  if (bucket) return bucket.file(storedName).createReadStream();
  return fs.createReadStream(path.join(uploadsDir, path.basename(storedName)));
}

export async function removeFile(storedName: string, uploadsDir: string): Promise<void> {
  if (bucket) {
    await bucket.file(storedName).delete({ ignoreNotFound: true } as never);
    return;
  }
  const fp = path.join(uploadsDir, path.basename(storedName));
  await fs.promises.unlink(fp).catch(() => {}); // ignore ENOENT
}
