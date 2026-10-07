import { AppError } from '../../utils/errors.js';

const DEFAULT_DEV_USER_ID = '123';

// Section 3 — Fake Current User.
// Reads `x-user-id` header and exposes `req.user = { id }`.
// Falls back to DEFAULT_DEV_USER_ID so health checks / local dev work
// without the header; strict per-user scoping still applies downstream.
export function fakeAuth(req, res, next) {
  const raw = req.header('x-user-id');

  if (raw === undefined || raw === null || String(raw).trim() === '') {
    req.user = { id: DEFAULT_DEV_USER_ID };
    return next();
  }

  const id = String(raw).trim();

  if (id.length > 255) {
    return next(new AppError('Invalid x-user-id header', 400));
  }

  req.user = { id };
  return next();
}

export default fakeAuth;
