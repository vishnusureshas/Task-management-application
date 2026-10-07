import { env } from '../../config/env.js';

export function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: 'OK',
    data: {
      status: 'up',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
}

export default getHealth;
