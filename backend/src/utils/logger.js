const levels = ['debug', 'info', 'warn', 'error'];
const currentLevel = process.env.LOG_LEVEL ?? 'info';
const levelRank = Object.fromEntries(levels.map((l, i) => [l, i]));

function format(level, message, meta) {
  const timestamp = new Date().toISOString();
  const extra = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${extra}`;
}

function shouldLog(level) {
  return (levelRank[level] ?? 1) >= (levelRank[currentLevel] ?? 1);
}

export const logger = {
  debug(message, meta) {
    if (shouldLog('debug')) console.debug(format('debug', message, meta));
  },
  info(message, meta) {
    if (shouldLog('info')) console.info(format('info', message, meta));
  },
  warn(message, meta) {
    if (shouldLog('warn')) console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    if (shouldLog('error')) console.error(format('error', message, meta));
  },
};

export default logger;
