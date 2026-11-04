/**
 * Error Boundary system for Smart Building Command Center
 * Provides error catching, recovery mechanisms, and user-friendly error display
 */

import { logger } from './logger';
import { store, actions } from './store';
import { eventBus, eventFactory } from './event_bus';

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  DEVICE = 'device',
  API = 'api',
  UI = 'ui',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  timestamp: Date;
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
  recovered: boolean;
}

// ============================================================================
// ERROR BOUNDARY CLASS
// ============================================================================

class ErrorBoundary {
  private errorHistory: AppError[] = [];
  private maxHistorySize = 50;
  private recoveryStrategies: Map<ErrorCategory, RecoveryStrategy> = new Map();
  private isRecovering = false;

  constructor() {
    this.setupDefaultRecoveryStrategies();
    this.setupGlobalHandlers();
  }

  // Setup default recovery strategies for each error category
  private setupDefaultRecoveryStrategies(): void {
    this.recoveryStrategies.set(ErrorCategory.NETWORK, {
      canRecover: true,
      recover: async (error: AppError) => {
        logger.info('Attempting network recovery', 'error-boundary');
        // Wait and retry could be implemented here
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
    });

    this.recoveryStrategies.set(ErrorCategory.VALIDATION, {
      canRecover: true,
      recover: async (error: AppError) => {
        logger.info('Attempting validation recovery', 'error-boundary');
        // Use default values or sanitize input
        return true;
      }
    });

    this.recoveryStrategies.set(ErrorCategory.DEVICE, {
      canRecover: true,
      recover: async (error: AppError) => {
        logger.info('Attempting device recovery', 'error-boundary');
        // Reset device state
        store.dispatch(actions.setDeviceConnected(false));
        return true;
      }
    });

    this.recoveryStrategies.set(ErrorCategory.API, {
      canRecover: true,
      recover: async (error: AppError) => {
        logger.info('Attempting API recovery', 'error-boundary');
        // Could implement retry logic here
        return false;
      }
    });

    this.recoveryStrategies.set(ErrorCategory.UI, {
      canRecover: true,
      recover: async (error: AppError) => {
        logger.info('Attempting UI recovery', 'error-boundary');
        // Reload or reset UI state
        return true;
      }
    });

    this.recoveryStrategies.set(ErrorCategory.SYSTEM, {
      canRecover: false,
      recover: async () => false
    });

    this.recoveryStrategies.set(ErrorCategory.UNKNOWN, {
      canRecover: false,
      recover: async () => false
    });
  }

  // Setup global error handlers
  private setupGlobalHandlers(): void {
    window.addEventListener('error', (event) => {
      this.handleError(
        event.message || 'Unknown error',
        ErrorCategory.SYSTEM,
        event.error,
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason?.message || 'Unhandled promise rejection',
        ErrorCategory.SYSTEM,
        event.reason
      );
    });

    logger.info('Error boundary initialized', 'error-boundary');
  }

  // Handle an error
  handleError(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    error?: Error,
    context?: Record<string, any>
  ): AppError {
    const appError: AppError = {
      id: this.generateErrorId(),
      message,
      category,
      timestamp: new Date(),
      stack: error?.stack,
      context,
      recoverable: this.recoveryStrategies.get(category)?.canRecover || false,
      recovered: false
    };

    // Add to history
    this.errorHistory.push(appError);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Log the error
    logger.error(`[${category.toUpperCase()}] ${message}`, error, 'error-boundary', context);

    // Dispatch to store
    store.dispatch(actions.addToast(
      `${category}: ${message}`,
      'alert'
    ));

    // Publish event
    eventBus.publish(eventFactory.systemError(error || new Error(message), {
      category,
      context
    }));

    // Attempt recovery if possible
    if (appError.recoverable && !this.isRecovering) {
      this.attemptRecovery(appError);
    }

    return appError;
  }

  // Attempt to recover from an error
  private async attemptRecovery(error: AppError): Promise<void> {
    if (this.isRecovering) {
      logger.warn('Recovery already in progress', 'error-boundary');
      return;
    }

    this.isRecovering = true;
    const strategy = this.recoveryStrategies.get(error.category);

    if (strategy?.canRecover) {
      try {
        logger.info(`Attempting recovery for ${error.category}`, 'error-boundary');
        const recovered = await strategy.recover(error);

        if (recovered) {
          error.recovered = true;
          store.dispatch(actions.addToast('Recovery successful', 'success'));
          logger.info('Recovery successful', 'error-boundary');
        } else {
          store.dispatch(actions.addToast('Recovery failed', 'alert'));
          logger.warn('Recovery failed', 'error-boundary');
        }
      } catch (recoveryError) {
        logger.error('Error during recovery', recoveryError as Error, 'error-boundary');
        store.dispatch(actions.addToast('Recovery failed with error', 'alert'));
      }
    }

    this.isRecovering = false;
  }

  // Wrap a function with error boundary
  wrap<T extends (...args: any[]) => any>(
    fn: T,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context?: Record<string, any>
  ): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);

        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            this.handleError(
              error.message || 'Async function error',
              category,
              error,
              context
            );
            throw error;
          });
        }

        return result;
      } catch (error) {
        this.handleError(
          (error as Error).message || 'Function error',
          category,
          error as Error,
          context
        );
        throw error;
      }
    }) as T;
  }

  // Wrap an async function with error boundary
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context?: Record<string, any>
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(
          (error as Error).message || 'Async function error',
          category,
          error as Error,
          context
        );
        throw error;
      }
    }) as T;
  }

  // Get error history
  getErrors(filter?: { category?: ErrorCategory; limit?: number }): AppError[] {
    let filtered = [...this.errorHistory];

    if (filter?.category) {
      filtered = filtered.filter(e => e.category === filter.category);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  // Get unrecovered errors
  getUnrecoveredErrors(): AppError[] {
    return this.errorHistory.filter(e => !e.recovered && e.recoverable);
  }

  // Clear error history
  clearErrors(): void {
    this.errorHistory = [];
    logger.info('Error history cleared', 'error-boundary');
  }

  // Add custom recovery strategy
  addRecoveryStrategy(category: ErrorCategory, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(category, strategy);
    logger.info(`Added recovery strategy for ${category}`, 'error-boundary');
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get error statistics
  getStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    recovered: number;
    unrecovered: number
  } {
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      validation: 0,
      device: 0,
      api: 0,
      ui: 0,
      system: 0,
      unknown: 0
    };

    this.errorHistory.forEach(error => {
      byCategory[error.category]++;
    });

    return {
      total: this.errorHistory.length,
      byCategory,
      recovered: this.errorHistory.filter(e => e.recovered).length,
      unrecovered: this.errorHistory.filter(e => !e.recovered && e.recoverable).length
    };
  }
}

// ============================================================================
// RECOVERY STRATEGY INTERFACE
// ============================================================================

interface RecoveryStrategy {
  canRecover: boolean;
  recover: (error: AppError) => Promise<boolean>;
}

// ============================================================================
// CREATE ERROR BOUNDARY INSTANCE
// ============================================================================

export const errorBoundary = new ErrorBoundary();

// ============================================================================
// CONVENIENCE ERROR HANDLERS
// ============================================================================

/**
 * Handle network errors
 */
export function handleNetworkError(message: string, error?: Error, context?: Record<string, any>): void {
  errorBoundary.handleError(message, ErrorCategory.NETWORK, error, context);
}

/**
 * Handle validation errors
 */
export function handleValidationError(message: string, context?: Record<string, any>): void {
  errorBoundary.handleError(message, ErrorCategory.VALIDATION, undefined, context);
}

/**
 * Handle device errors
 */
export function handleDeviceError(message: string, error?: Error, context?: Record<string, any>): void {
  errorBoundary.handleError(message, ErrorCategory.DEVICE, error, context);
}

/**
 * Handle API errors
 */
export function handleApiError(message: string, error?: Error, context?: Record<string, any>): void {
  errorBoundary.handleError(message, ErrorCategory.API, error, context);
}

/**
 * Handle UI errors
 */
export function handleUIError(message: string, error?: Error, context?: Record<string, any>): void {
  errorBoundary.handleError(message, ErrorCategory.UI, error, context);
}

// ============================================================================
// ERROR DISPLAY COMPONENT
// ============================================================================

/**
 * Create an error display element in the DOM
 */
export function createErrorDisplay(error: AppError): HTMLElement {
  const container = document.createElement('div');
  container.className = 'error-display';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(239, 68, 68, 0.95);
    color: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <span style="font-weight: 700; text-transform: uppercase;">${error.category}</span>
    </div>
    <div style="margin-bottom: 0.5rem;">${error.message}</div>
    ${error.recoverable ? `
      <button id="retry-${error.id}" style="
        background: white;
        color: #ef4444;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      ">Retry</button>
    ` : ''}
    <button id="dismiss-${error.id}" style="
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 0.5rem;
    ">Dismiss</button>
  `;

  // Add event listeners
  if (error.recoverable) {
    const retryBtn = container.querySelector(`#retry-${error.id}`) as HTMLButtonElement;
    retryBtn.addEventListener('click', () => {
      errorBoundary.attemptRecovery(error);
      container.remove();
    });
  }

  const dismissBtn = container.querySelector(`#dismiss-${error.id}`) as HTMLButtonElement;
  dismissBtn.addEventListener('click', () => {
    container.remove();
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (container.parentNode) {
      container.style.opacity = '0';
      setTimeout(() => container.remove(), 300);
    }
  }, 10000);

  return container;
}

/**
 * Show error display in the DOM
 */
export function showErrorDisplay(error: AppError): void {
  const display = createErrorDisplay(error);
  document.body.appendChild(display);
}

// ============================================================================
// ADD CSS ANIMATION FOR ERROR DISPLAY
// ============================================================================

export function injectErrorStyles(): void {
  if (document.getElementById('error-boundary-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'error-boundary-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
