import { Router } from 'express';
import { fakeAuth } from '../middleware/fakeAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as queueController from '../controllers/queue.controller.js';

const router = Router();

// Same user-context rule as other /api/* routes (health excepted).
router.use(fakeAuth);

router.get('/:name/metrics', asyncHandler(queueController.getQueueMetrics));

export default router;
