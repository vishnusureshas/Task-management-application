import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { env } from '../config/env.js';

// Isolated local storage layer (Section 18). All file knowledge lives
// here so a future S3-compatible backend only replaces this module.
export const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
export const stagingDir = path.join(uploadRoot, 'tmp');
export const originalsDir = path.join(uploadRoot, 'originals');
export const thumbnailsDir = path.join(uploadRoot, 'thumbnails');

await mkdir(stagingDir, { recursive: true });
await mkdir(originalsDir, { recursive: true });
await mkdir(thumbnailsDir, { recursive: true });

// Allowed image MIME types → canonical extension.
export const ALLOWED_IMAGE_MIME = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

export function extensionForMime(mimeType) {
  return ALLOWED_IMAGE_MIME.get(mimeType) ?? null;
}

export function uniqueName(prefix, ext) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}${ext}`;
}

// API intake parks raw buffers here; the image worker moves them to
// their final locations (plan flow: worker stores original + thumbnail).
export async function stageBuffer(buffer, filename) {
  const absolutePath = path.join(stagingDir, filename);
  await writeFile(absolutePath, buffer);
  return absolutePath;
}

export async function storeOriginal(filename, buffer) {
  await writeFile(path.join(originalsDir, filename), buffer);
}

export async function storeThumbnail(filename, buffer) {
  await writeFile(path.join(thumbnailsDir, filename), buffer);
}

export async function removeStaged(absolutePath) {
  if (!absolutePath) return;
  await unlink(absolutePath).catch(() => {});
}

export function originalUrlFor(filename) {
  return `/uploads/originals/${filename}`;
}

export function thumbnailUrlFor(filename) {
  return `/uploads/thumbnails/${filename}`;
}
