// Client-side mirror of the backend upload rules (plan §5.2).
// Backend remains the authority; this only fails fast with friendly hints.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_FILES = 5;
export const MAX_FILE_MB = 5;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export function validateFiles(fileList) {
  const files = [...(fileList ?? [])];
  if (files.length > MAX_FILES) {
    return `Too many files. Maximum is ${MAX_FILES}.`;
  }
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `Unsupported image type: ${file.type || file.name}. Allowed: jpeg, png, webp, gif.`;
    }
    if (file.size > MAX_FILE_BYTES) {
      return `File too large: ${file.name}. Maximum is ${MAX_FILE_MB}MB per file.`;
    }
  }
  return '';
}
