import { AppError } from '../../utils/errors.js';

export function notFound(req, res, next) {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
}

export default notFound;
