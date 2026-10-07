export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export function notFoundError(resource = 'Resource') {
  return new AppError(`${resource} not found`, 404);
}

export function badRequestError(message = 'Bad request') {
  return new AppError(message, 400);
}

// Section 12 status-code matrix: 400 validation, 404 not found,
// 409 conflict, 500 unexpected (centralized error middleware maps
// AppError.statusCode → JSON { success: false, message }).
export function conflictError(message = 'Conflict') {
  return new AppError(message, 409);
}

export default AppError;
