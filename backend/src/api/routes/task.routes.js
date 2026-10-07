import { Router } from 'express';
import { fakeAuth } from '../middleware/fakeAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadImages } from '../middleware/upload.js';
import { validateCreateTaskBody, validateStatusBody } from '../validators/task.validator.js';
import * as taskController from '../controllers/task.controller.js';

const router = Router();

// All task routes are scoped to the fake current user (Section 3).
router.use(fakeAuth);

// Section 8: same endpoint accepts JSON (no files) or multipart images.
router.post('/', uploadImages, validateCreateTaskBody, asyncHandler(taskController.createTask));
router.get('/', asyncHandler(taskController.listTasks));
router.patch('/:id/status', validateStatusBody, asyncHandler(taskController.updateTaskStatus));

export default router;
