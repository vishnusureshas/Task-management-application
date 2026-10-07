import { MulterError } from 'multer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Centralized Express error handler (must have 4 args).
// Final response shape follows the plan: { success: false, message }
export function errorHandler(err, req, res, _next) {
  // Section 8: Multer upload failures are client errors, not 500s.
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum is ${env.maxUploadMb}MB per file`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Too many files. Maximum is ${env.maxUploadFiles}`
          : err.message || 'File upload failed';
    logger.warn(message, { method: req.method, url: req.originalUrl, code: err.code });
    return res.status(400).json({ success: false, message });
  }

  const statusCode = err?.statusCode ?? 500;
  const message = err?.message ?? 'Internal server error';

  if (statusCode >= 500) {
    logger.error(message, {
      method: req.method,
      url: req.originalUrl,
      stack: err?.stack,
    });
  } else {
    logger.warn(message, { method: req.method, url: req.originalUrl, statusCode });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err?.stack } : {}),
  });
}

export default errorHandler;
