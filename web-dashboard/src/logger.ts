/**
 * Structured logging system for Smart Building Command Center
 * Provides leveled logging with context, performance metrics, and export capabilities
 */

import { LogLevel, LogEntry, LoggerConfig } from './store_types';

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private performanceMarks: Map<string, number> = new Map();
  private storageKey = 'sbc_logs';

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: config?.minLevel || 'info',
      enableConsole: config?.enableConsole !== false,
      enableStorage: config?.enableStorage !== false,
      maxStorageEntries: config?.maxStorageEntries || 500,
      includeTimestamp: config?.includeTimestamp !== false
    };

    this.loadLogs();
  }

  // Update logger configuration
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Log at debug level
  debug(message: string, context?: string, data?: Record<string, any>): void {
    this.log('debug', message, context, data);
  }

  // Log at info level
  info(message: string, context?: string, data?: Record<string, any>): void {
    this.log('info', message, context, data);
  }

  // Log at warn level
  warn(message: string, context?: string, data?: Record<string, any>): void {
    this.log('warn', message, context, data);
  }

  // Log at error level
  error(message: string, error?: Error, context?: string, data?: Record<string, any>): void {
    this.log('error', message, context, data, error);
  }

  // Core logging method
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: Record<string, any>,
    error?: Error
  ): void {
    // Check if level is enabled
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      data,
      error
    };

    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.config.maxStorageEntries) {
      this.logs.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Storage
    if (this.config.enableStorage) {
      this.persistLogs();
    }
  }

  // Check if a log level is enabled
  private isLevelEnabled(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.minLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  // Output to console with appropriate formatting
  private outputToConsole(entry: LogEntry): void {
    const timestamp = this.config.includeTimestamp
      ? `[${entry.timestamp.toISOString()}]`
      : '';
    const context = entry.context ? `[${entry.context}]` : '';
    const prefix = `${timestamp} ${context} [${entry.level.toUpperCase()}]`;

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.data || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.data || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.data || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.error || '', entry.data || '');
        break;
    }
  }

  // Performance measurement - start
  startMeasure(name: string): void {
    this.performanceMarks.set(name, performance.now());
    this.debug(`Started measurement: ${name}`, 'performance');
  }

  // Performance measurement - end
  endMeasure(name: string): number {
    const startTime = this.performanceMarks.get(name);
    if (startTime === undefined) {
      this.warn(`No measurement found for: ${name}`, 'performance');
      return 0;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(name);
    this.info(`Measurement ${name}: ${duration.toFixed(2)}ms`, 'performance', { duration });
    return duration;
  }

  // Measure async function execution time
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.startMeasure(name);
    try {
      const result = await fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  // Measure sync function execution time
  measure<T>(name: string, fn: () => T): T {
    this.startMeasure(name);
    try {
      const result = fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  // Get logs filtered by level and/or context
  getLogs(filter?: { level?: LogLevel; context?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.context) {
      filtered = filtered.filter(log => log.context === filter.context);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Get logs by context
  getLogsByContext(context: string): LogEntry[] {
    return this.logs.filter(log => log.context === context);
  }

  // Get error logs
  getErrorLogs(): LogEntry[] {
    return this.getLogsByLevel('error');
  }

  // Clear all logs
  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(this.storageKey);
    this.info('Logs cleared', 'logger');
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Export logs as CSV
  exportLogsAsCsv(): string {
    const headers = ['Timestamp', 'Level', 'Context', 'Message', 'Data', 'Error'];
    const rows = this.logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      log.context || '',
      log.message,
      log.data ? JSON.stringify(log.data) : '',
      log.error ? log.error.message : ''
    ]);

    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
  }

  // Download logs as file
  downloadLogs(format: 'json' | 'csv' = 'json'): void {
    const content = format === 'json' ? this.exportLogs() : this.exportLogsAsCsv();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sbc_logs_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Persist logs to localStorage
  private persistLogs(): void {
    try {
      // Only store last N logs to avoid quota issues
      const toSave = this.logs.slice(-this.config.maxStorageEntries);
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
    } catch (error) {
      console.error('Error persisting logs:', error);
    }
  }

  // Load logs from localStorage
  private loadLogs(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.logs = parsed.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading logs from storage:', error);
    }
  }

  // Get log statistics
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byContext: Record<string, number>;
    errorCount: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };
    const byContext: Record<string, number> = {};

    this.logs.forEach(log => {
      byLevel[log.level]++;
      if (log.context) {
        byContext[log.context] = (byContext[log.context] || 0) + 1;
      }
    });

    return {
      total: this.logs.length,
      byLevel,
      byContext,
      errorCount: byLevel.error
    };
  }
}

// ============================================================================
// CREATE LOGGER INSTANCE
// ============================================================================

export const logger = new Logger({
  minLevel: 'info',
  enableConsole: true,
  enableStorage: true,
  maxStorageEntries: 500,
  includeTimestamp: true
});

// ============================================================================
// CONVENIENCE CONTEXT-BASED LOGGERS
// ============================================================================

export const createContextLogger = (context: string) => ({
  debug: (message: string, data?: Record<string, any>) =>
    logger.debug(message, context, data),
  info: (message: string, data?: Record<string, any>) =>
    logger.info(message, context, data),
  warn: (message: string, data?: Record<string, any>) =>
    logger.warn(message, context, data),
  error: (message: string, error?: Error, data?: Record<string, any>) =>
    logger.error(message, error, context, data)
});

// Pre-configured context loggers
export const weatherLogger = createContextLogger('weather');
export const deviceLogger = createContextLogger('device');
export const uiLogger = createContextLogger('ui');
export const apiLogger = createContextLogger('api');
export const firebaseLogger = createContextLogger('firebase');
export const storeLogger = createContextLogger('store');
export const eventLogger = createContextLogger('events');

// ============================================================================
// GLOBAL ERROR HANDLER INTEGRATION
// ============================================================================

/**
 * Setup global error handlers to catch uncaught errors
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logger.error(
      `Uncaught error: ${event.message}`,
      event.error,
      'global',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    );
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error(
      `Unhandled promise rejection: ${event.reason}`,
      event.reason instanceof Error ? event.reason : undefined,
      'global',
      { reason: event.reason }
    );
  });

  logger.info('Global error handlers initialized', 'system');
}

// ============================================================================
// LOGGING DECORATOR FOR PERFORMANCE TRACKING
// ============================================================================

/**
 * Decorator to automatically log method execution time
 */
export function logPerformance(context: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const name = `${context}.${propertyKey}`;
      logger.startMeasure(name);
      try {
        const result = await originalMethod.apply(this, args);
        logger.endMeasure(name);
        return result;
      } catch (error) {
        logger.endMeasure(name);
        logger.error(`Error in ${name}`, error as Error, context);
        throw error;
      }
    };

    return descriptor;
  };
}
