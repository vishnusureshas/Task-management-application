import { AppError } from '../../utils/errors.js';

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
export const TASK_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateCreateTaskBody(req, res, next) {
  const { title, description, priority, processingType } = req.body ?? {};

  const cleanTitle = asTrimmedString(title);
  if (!cleanTitle) {
    return next(new AppError('Title is required', 400));
  }
  if (cleanTitle.length > 255) {
    return next(new AppError('Title must be at most 255 characters', 400));
  }

  if (description !== undefined && typeof description !== 'string') {
    return next(new AppError('Description must be a string', 400));
  }

  const cleanPriority = priority === undefined ? 'MEDIUM' : String(priority).toUpperCase().trim();
  if (!TASK_PRIORITIES.includes(cleanPriority)) {
    return next(new AppError(`Priority must be one of: ${TASK_PRIORITIES.join(', ')}`, 400));
  }

  const cleanProcessingType =
    processingType === undefined ? 'STANDARD' : asTrimmedString(processingType).toUpperCase() || 'STANDARD';
  if (cleanProcessingType.length > 50) {
    return next(new AppError('processingType must be at most 50 characters', 400));
  }

  req.validatedBody = {
    title: cleanTitle,
    description: description === undefined ? null : String(description),
    priority: cleanPriority,
    processingType: cleanProcessingType,
  };
  return next();
}

export function validateStatusBody(req, res, next) {
  const { status } = req.body ?? {};
  const cleanStatus = typeof status === 'string' ? status.toUpperCase().trim() : '';

  if (!TASK_STATUSES.includes(cleanStatus)) {
    return next(new AppError(`Status must be one of: ${TASK_STATUSES.join(', ')}`, 400));
  }

  req.validatedBody = { status: cleanStatus };
  return next();
}
