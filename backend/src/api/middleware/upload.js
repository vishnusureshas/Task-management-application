import multer from 'multer';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { ALLOWED_IMAGE_MIME } from '../../storage/localStorage.js';

// Accepted multipart field names for task images.
export const IMAGE_FIELDS = ['images', 'documents'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadBytes,
    files: env.maxUploadFiles,
  },
  // Section 16: MIME allow-list enforced before any job is queued.
  // The worker re-validates real bytes via Sharp (defense in depth).
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      return cb(
        new AppError(
          `Unsupported image type: ${file.mimetype}. Allowed: ${[...ALLOWED_IMAGE_MIME.keys()].join(', ')}`,
          400,
        ),
      );
    }
    cb(null, true);
  },
}).fields(IMAGE_FIELDS.map((name) => ({ name, maxCount: env.maxUploadFiles })));

// Runs Multer only for multipart requests so the same POST /api/tasks
// endpoint keeps accepting plain JSON. Normalizes to req.files = [].
export function uploadImages(req, res, next) {
  const contentType = req.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    req.files = [];
    return next();
  }

  upload(req, res, (err) => {
    if (err) return next(err);

    const grouped = req.files ?? {};
    const files = [...(grouped.images ?? []), ...(grouped.documents ?? [])];

    if (files.length > env.maxUploadFiles) {
      return next(new AppError(`Too many files. Maximum is ${env.maxUploadFiles}`, 400));
    }

    req.files = files;
    return next();
  });
}

export default uploadImages;
