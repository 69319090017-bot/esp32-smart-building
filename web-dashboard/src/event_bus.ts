/**
 * Event Bus for Smart Building Command Center
 * Implements publish-subscribe pattern for decoupled component communication
 */

import {
  BaseEvent,
  AppEvent,
  EventType,
  EventListener,
  EventSubscription,
  WeatherUpdatedEvent,
  WeatherErrorEvent,
  DeviceChangedEvent,
  DeviceConnectedEvent,
  DeviceDisconnectedEvent,
  AlertTriggeredEvent,
  AlertClearedEvent,
  UserActionEvent,
  SystemStartupEvent,
  SystemErrorEvent
} from './store_types';

// ============================================================================
// EVENT BUS CLASS
// ============================================================================

class EventBus {
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private eventHistory: AppEvent[] = [];
  private maxHistorySize = 100;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private subscriptionCounter = 0;

  // Subscribe to an event type
  subscribe<T extends AppEvent>(
    eventType: EventType,
    listener: EventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.add(listener as EventListener);

    // Create subscription
    const id = `sub-${this.subscriptionCounter++}`;
    this.subscriptions.set(id, {
      eventType,
      listener: listener as EventListener,
      id
    });

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as EventListener);
      this.subscriptions.delete(id);
    };
  }

  // Publish an event
  publish(event: AppEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          const result = listener(event);
          // Handle async listeners
          if (result instanceof Promise) {
            result.catch(error => {
              console.error(`Error in async event listener for ${event.type}:`, error);
            });
          }
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }

  // Unsubscribe all listeners for an event type
  unsubscribe(eventType: EventType): void {
    this.listeners.delete(eventType);
    // Remove related subscriptions
    for (const [id, sub] of this.subscriptions.entries()) {
      if (sub.eventType === eventType) {
        this.subscriptions.delete(id);
      }
    }
  }

  // Unsubscribe a specific subscription by ID
  unsubscribeById(id: string): void {
    const sub = this.subscriptions.get(id);
    if (sub) {
      const listeners = this.listeners.get(sub.eventType);
      if (listeners) {
        listeners.delete(sub.listener);
      }
      this.subscriptions.delete(id);
    }
  }

  // Clear all listeners
  clear(): void {
    this.listeners.clear();
    this.subscriptions.clear();
    this.eventHistory = [];
  }

  // Get event history
  getHistory(eventType?: EventType): AppEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  // Get number of active subscriptions
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Get listeners count per event type
  getListenersCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }
}

// ============================================================================
// EVENT FACTORY FUNCTIONS
// ============================================================================

function createBaseEvent(type: EventType, source: string): BaseEvent {
  return {
    type,
    timestamp: new Date(),
    source
  };
}

export const eventFactory = {
  weatherUpdated: (
    data: WeatherUpdatedEvent['data'],
    severity: WeatherUpdatedEvent['severity'],
    province: WeatherUpdatedEvent['province'],
    source = 'weather-service'
  ): WeatherUpdatedEvent => ({
    ...createBaseEvent('weather:updated', source),
    type: 'weather:updated',
    data,
    severity,
    province
  }),

  weatherError: (
    error: WeatherErrorEvent['error'],
    province: WeatherErrorEvent['province'],
    source = 'weather-service'
  ): WeatherErrorEvent => ({
    ...createBaseEvent('weather:error', source),
    type: 'weather:error',
    error,
    province
  }),

  deviceChanged: (
    device: DeviceChangedEvent['device'],
    action: DeviceChangedEvent['action'],
    previousValue: DeviceChangedEvent['previousValue'],
    newValue: DeviceChangedEvent['newValue'],
    source = 'device-controller'
  ): DeviceChangedEvent => ({
    ...createBaseEvent('device:changed', source),
    type: 'device:changed',
    device,
    action,
    previousValue,
    newValue
  }),

  deviceConnected: (
    deviceId: DeviceConnectedEvent['deviceId'],
    source = 'device-controller'
  ): DeviceConnectedEvent => ({
    ...createBaseEvent('device:connected', source),
    type: 'device:connected',
    deviceId
  }),

  deviceDisconnected: (
    deviceId: DeviceDisconnectedEvent['deviceId'],
    reason?: DeviceDisconnectedEvent['reason'],
    source = 'device-controller'
  ): DeviceDisconnectedEvent => ({
    ...createBaseEvent('device:disconnected', source),
    type: 'device:disconnected',
    deviceId,
    reason
  }),

  alertTriggered: (
    severity: AlertTriggeredEvent['severity'],
    message: AlertTriggeredEvent['message'],
    province: AlertTriggeredEvent['province'],
    source = 'alert-system'
  ): AlertTriggeredEvent => ({
    ...createBaseEvent('alert:triggered', source),
    type: 'alert:triggered',
    severity,
    message,
    province
  }),

  alertCleared: (
    severity: AlertClearedEvent['severity'],
    source = 'alert-system'
  ): AlertClearedEvent => ({
    ...createBaseEvent('alert:cleared', source),
    type: 'alert:cleared',
    severity
  }),

  userAction: (
    action: UserActionEvent['action'],
    details?: UserActionEvent['details'],
    source = 'ui'
  ): UserActionEvent => ({
    ...createBaseEvent('user:action', source),
    type: 'user:action',
    action,
    details
  }),

  systemStartup: (
    version: SystemStartupEvent['version'],
    source = 'system'
  ): SystemStartupEvent => ({
    ...createBaseEvent('system:startup', source),
    type: 'system:startup',
    version
  }),

  systemError: (
    error: SystemErrorEvent['error'],
    context?: SystemErrorEvent['context'],
    source = 'system'
  ): SystemErrorEvent => ({
    ...createBaseEvent('system:error', source),
    type: 'system:error',
    error,
    context
  })
};

// ============================================================================
// CREATE EVENT BUS INSTANCE
// ============================================================================

export const eventBus = new EventBus();

// ============================================================================
// TYPE GUARDS FOR EVENTS
// ============================================================================

export function isWeatherUpdatedEvent(event: AppEvent): event is WeatherUpdatedEvent {
  return event.type === 'weather:updated';
}

export function isWeatherErrorEvent(event: AppEvent): event is WeatherErrorEvent {
  return event.type === 'weather:error';
}

export function isDeviceChangedEvent(event: AppEvent): event is DeviceChangedEvent {
  return event.type === 'device:changed';
}

export function isDeviceConnectedEvent(event: AppEvent): event is DeviceConnectedEvent {
  return event.type === 'device:connected';
}

export function isDeviceDisconnectedEvent(event: AppEvent): event is DeviceDisconnectedEvent {
  return event.type === 'device:disconnected';
}

export function isAlertTriggeredEvent(event: AppEvent): event is AlertTriggeredEvent {
  return event.type === 'alert:triggered';
}

export function isAlertClearedEvent(event: AppEvent): event is AlertClearedEvent {
  return event.type === 'alert:cleared';
}

export function isUserActionEvent(event: AppEvent): event is UserActionEvent {
  return event.type === 'user:action';
}

export function isSystemStartupEvent(event: AppEvent): event is SystemStartupEvent {
  return event.type === 'system:startup';
}

export function isSystemErrorEvent(event: AppEvent): event is SystemErrorEvent {
  return event.type === 'system:error';
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

/**
 * Subscribe to all events for debugging purposes
 * Returns unsubscribe function
 */
export function debugLogAllEvents(): () => void {
  const unsubscribe = eventBus.subscribe('weather:updated' as EventType, (event) => {
    console.log('[EventBus]', event.type, event);
  });

  // Subscribe to all event types
  const eventTypes: EventType[] = [
    'weather:updated',
    'weather:error',
    'device:changed',
    'device:connected',
    'device:disconnected',
    'alert:triggered',
    'alert:cleared',
    'user:action',
    'system:startup',
    'system:error'
  ];

  const unsubscribers = eventTypes.map(type =>
    eventBus.subscribe(type, (event) => {
      console.log(`[EventBus:${type}]`, event);
    })
  );

  return () => {
    unsubscribe();
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Export event history as JSON
 */
export function exportEventHistory(): string {
  return JSON.stringify(eventBus.getHistory(), null, 2);
}

/**
 * Clear event history
 */
export function clearEventHistory(): void {
  (eventBus as any).eventHistory = [];
}
