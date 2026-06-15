type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }
  const line = JSON.stringify(entry)
  level === 'error' ? console.error(line) : console.log(line)
}

export const logger = {
  info:  (message: string, meta?: Record<string, unknown>) => write('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => write('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
}
