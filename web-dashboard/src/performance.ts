/**
 * Performance Monitoring and Optimization Utilities
 * Smart Building Command Center - Performance Module
 */

// Core Web Vitals Tracking
interface CoreWebVitals {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
}

interface PerformanceMetrics {
  memoryUsage?: number;
  fps: number;
  frameTime: number;
  renderTime: number;
  networkLatency: number;
  apiResponseTime: number;
}

class PerformanceMonitor {
  private metrics: CoreWebVitals = {};
  private realtimeMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    renderTime: 0,
    networkLatency: 0,
    apiResponseTime: 0
  };
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private animationFrameId: number | null = null;
  private observers: Set<PerformanceObserver> = new Set();
  private isDebugMode = false;
  private metricsHistory: Array<{ timestamp: number; metrics: PerformanceMetrics }> = [];
  private maxHistorySize = 100;

  constructor() {
    this.initCoreWebVitals();
    this.startFPSMonitoring();
  }

  /**
   * Initialize Core Web Vitals tracking
   */
  private initCoreWebVitals(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('[Performance] PerformanceObserver not supported');
      return;
    }

    // First Contentful Paint
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcp = entries[0] as any;
        this.metrics.FCP = fcp.startTime;
        this.logMetric('FCP', fcp.startTime);
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.add(fcpObserver);
    } catch (e) {
      console.warn('[Performance] FCP observer failed:', e);
    }

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1] as any;
        this.metrics.LCP = lcp.startTime;
        this.logMetric('LCP', lcp.startTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.add(lcpObserver);
    } catch (e) {
      console.warn('[Performance] LCP observer failed:', e);
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fid = entries[0] as any;
        this.metrics.FID = fid.processingStart - fid.startTime;
        this.logMetric('FID', this.metrics.FID);
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.add(fidObserver);
    } catch (e) {
      console.warn('[Performance] FID observer failed:', e);
    }

    // Cumulative Layout Shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          clsValue += (entry as any).value;
        }
        this.metrics.CLS = clsValue;
        this.logMetric('CLS', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.add(clsObserver);
    } catch (e) {
      console.warn('[Performance] CLS observer failed:', e);
    }

    // Navigation Timing (TTFB)
    if (performance.getEntriesByType('navigation').length > 0) {
      const navEntry = performance.getEntriesByType('navigation')[0] as any;
      this.metrics.TTFB = navEntry.responseStart - navEntry.requestStart;
      this.logMetric('TTFB', this.metrics.TTFB);
    }
  }

  /**
   * Start FPS monitoring using requestAnimationFrame
   */
  private startFPSMonitoring(): void {
    const measureFrame = () => {
      if (document.visibilityState !== 'visible') {
        this.animationFrameId = null;
        this.frameCount = 0;
        return;
      }

      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.frameCount++;

      // Update FPS every second
      if (delta >= 1000) {
        this.realtimeMetrics.fps = Math.round((this.frameCount * 1000) / delta);
        this.realtimeMetrics.frameTime = delta / this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;

        // Track memory if available
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          this.realtimeMetrics.memoryUsage = memory.usedJSHeapSize / 1048576; // MB
        }

        // Store in history
        this.metricsHistory.push({
          timestamp: Date.now(),
          metrics: { ...this.realtimeMetrics }
        });

        // Limit history size
        if (this.metricsHistory.length > this.maxHistorySize) {
          this.metricsHistory.shift();
        }

        if (this.isDebugMode) {
          console.log('[Performance] FPS:', this.realtimeMetrics.fps, 'Frame Time:', this.realtimeMetrics.frameTime.toFixed(2) + 'ms');
        }
      }

      this.animationFrameId = requestAnimationFrame(measureFrame);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        this.frameCount = 0;
      } else if (this.animationFrameId === null) {
        this.lastFrameTime = performance.now();
        this.animationFrameId = requestAnimationFrame(measureFrame);
      }
    });

    if (document.visibilityState === 'visible') {
      this.animationFrameId = requestAnimationFrame(measureFrame);
    }
  }

  /**
   * Log metric to console
   */
  private logMetric(name: string, value: number): void {
    if (this.isDebugMode) {
      console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
  }

  /**
   * Measure render time for a function
   */
  measureRenderTime<T>(fn: () => T, label: string): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    this.realtimeMetrics.renderTime = end - start;
    
    if (this.isDebugMode) {
      console.log(`[Performance] ${label} render time: ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  }

  /**
   * Measure API response time
   */
  async measureApiTime<T>(promise: Promise<T>, label: string): Promise<T> {
    const start = performance.now();
    try {
      const result = await promise;
      const end = performance.now();
      this.realtimeMetrics.apiResponseTime = end - start;
      
      if (this.isDebugMode) {
        console.log(`[Performance] ${label} API time: ${(end - start).toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const end = performance.now();
      this.realtimeMetrics.apiResponseTime = end - start;
      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CoreWebVitals & PerformanceMetrics {
    return {
      ...this.metrics,
      ...this.realtimeMetrics
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): Array<{ timestamp: number; metrics: PerformanceMetrics }> {
    return [...this.metricsHistory];
  }

  /**
   * Cleanup observers and animations
   */
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    return `
=== Performance Report ===
Core Web Vitals:
- FCP: ${metrics.FCP?.toFixed(2) || 'N/A'}ms (target: <1.8s)
- LCP: ${metrics.LCP?.toFixed(2) || 'N/A'}ms (target: <2.5s)
- FID: ${metrics.FID?.toFixed(2) || 'N/A'}ms (target: <100ms)
- CLS: ${metrics.CLS?.toFixed(3) || 'N/A'} (target: <0.1)
- TTFB: ${metrics.TTFB?.toFixed(2) || 'N/A'}ms (target: <600ms)

Real-time Metrics:
- FPS: ${metrics.fps} (target: 60)
- Frame Time: ${metrics.frameTime.toFixed(2)}ms
- Render Time: ${metrics.renderTime.toFixed(2)}ms
- API Response Time: ${metrics.apiResponseTime.toFixed(2)}ms
- Memory Usage: ${metrics.memoryUsage?.toFixed(2) || 'N/A'}MB
    `.trim();
  }
}

// Animation utilities using requestAnimationFrame
export class AnimationManager {
  private animations: Map<string, FrameRequestCallback> = new Map();
  private isRunning = false;

  /**
   * Register an animation with requestAnimationFrame
   */
  registerAnimation(id: string, callback: FrameRequestCallback): void {
    this.animations.set(id, callback);
    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Unregister an animation
   */
  unregisterAnimation(id: string): void {
    this.animations.delete(id);
    if (this.animations.size === 0) {
      this.stop();
    }
  }

  /**
   * Start animation loop
   */
  private start(): void {
    this.isRunning = true;
    const loop = (timestamp: number) => {
      if (this.animations.size === 0) {
        this.isRunning = false;
        return;
      }

      this.animations.forEach(callback => callback(timestamp));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * Stop animation loop
   */
  private stop(): void {
    this.isRunning = false;
  }

  /**
   * Clear all animations
   */
  clearAll(): void {
    this.animations.clear();
    this.isRunning = false;
  }
}

// Memory management utilities
export class MemoryManager {
  private static caches: Map<string, any> = new Map();
  private static maxCacheSize = 50;

  /**
   * Cache data with automatic cleanup
   */
  static setCache(key: string, value: any, ttl?: number): void {
    // Implement LRU eviction if cache is too large
    if (this.caches.size >= this.maxCacheSize) {
      const firstKey = this.caches.keys().next().value;
      if (firstKey !== undefined) {
        this.caches.delete(firstKey);
      }
    }

    const entry = { value, expires: ttl ? Date.now() + ttl : null };
    this.caches.set(key, entry);
  }

  /**
   * Get cached data
   */
  static getCache(key: string): any {
    const entry = this.caches.get(key);
    if (!entry) return null;

    // Check TTL
    if (entry.expires && Date.now() > entry.expires) {
      this.caches.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Clear expired cache entries
   */
  static clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.caches.entries()) {
      if (entry.expires && now > entry.expires) {
        this.caches.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  static clearAll(): void {
    this.caches.clear();
  }

  /**
   * Get cache size
   */
  static size(): number {
    return this.caches.size;
  }
}

// DOM batching utilities
export class DOMBatcher {
  private pendingUpdates: Array<() => void> = [];
  private scheduled = false;

  /**
   * Schedule a DOM update to be batched
   */
  schedule(update: () => void): void {
    this.pendingUpdates.push(update);

    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * Flush all pending updates
   */
  private flush(): void {
    const updates = this.pendingUpdates;
    this.pendingUpdates = [];
    this.scheduled = false;

    // Batch all updates together
    updates.forEach(update => {
      try {
        update();
      } catch (error) {
        console.error('[DOMBatcher] Update failed:', error);
      }
    });
  }

  /**
   * Force immediate flush
   */
  flushNow(): void {
    if (this.scheduled) {
      this.flush();
    }
  }
}

// Request caching for API calls
export class RequestCache {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Cache a request with TTL
   */
  async fetch(url: string, options?: RequestInit, ttl: number = 60000): Promise<any> {
    const cacheKey = url + JSON.stringify(options);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Bound slow requests so a stalled weather service cannot block updates indefinitely.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const requestOptions = { ...options, signal: options?.signal || controller.signal };

    // Make new request
    const promise = fetch(url, requestOptions)
      .then(response => {
        if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        this.cache.set(cacheKey, { data, timestamp: Date.now(), ttl });
        this.pendingRequests.delete(cacheKey);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(cacheKey);
        throw error;
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * Clear cache for a specific URL
   */
  clear(url: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(url)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Global instances
export const performanceMonitor = new PerformanceMonitor();
export const animationManager = new AnimationManager();
export const domBatcher = new DOMBatcher();
export const requestCache = new RequestCache();

// Export utilities
export { PerformanceMonitor };
