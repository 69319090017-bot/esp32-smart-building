/**
 * Communication Manager
 * 
 * This module provides:
 * - Graceful fallback to Firebase when WebSocket is unavailable
 * - Automatic failover and recovery
 * - Data merging from multiple sources
 * - User notification of communication mode
 */

import { WebSocketClient } from './websocket_client';
import { ConnectionState, ConnectionStatus, MessageType, WebSocketMessage, TelemetryMessage } from './websocket_types';
import { WEBSOCKET_CONFIG, FALLBACK_CONFIG, DEMO_PILOT_MODE } from './config';
import { createToast } from './ui_manager';

export enum CommunicationMode {
  WEBSOCKET = 'websocket',
  FIREBASE = 'firebase',
  HYBRID = 'hybrid'
}

export interface TelemetryData {
  temperature?: number;
  humidity?: number;
  uv_index?: number;
  wind_speed?: number;
  wind_gusts?: number;
  precipitation?: number;
  weather_code?: number;
  river_discharge?: number;
  relay_states?: {
    strobe: boolean;
    door: boolean;
    siren: boolean;
  };
  battery_level?: number;
  signal_strength?: number;
  uptime_sec?: number;
  severity?: string;
  province?: string;
}

export class CommunicationManager {
  private websocketClient: WebSocketClient | null = null;
  private currentMode: CommunicationMode = CommunicationMode.WEBSOCKET;
  private fallbackTimer: number | null = null;
  private telemetryCallbacks: Set<(data: TelemetryData) => void> = new Set();
  private modeChangeCallbacks: Set<(mode: CommunicationMode) => void> = new Set();
  private lastTelemetry: TelemetryData | null = null;
  private isFirebaseAvailable: boolean = false;
  private connectionAttempts: number = 0;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize communication manager
   */
  private initialize(): void {
    if (DEMO_PILOT_MODE) {
      console.log('[CommManager] Demo pilot mode enabled: API-first + laptop speaker mode');
      this.switchMode(CommunicationMode.FIREBASE);
      if (FALLBACK_CONFIG.notifyFallbackMode) {
        createToast('Pilot mode: ข้อมูลจาก API และลำโพงโน้ตบุ๊กทำงานก่อน', 'info');
      }
      return;
    }

    // Try to establish WebSocket connection
    this.tryWebSocketConnection();
  }

  /**
   * Try to establish WebSocket connection
   */
  private tryWebSocketConnection(): void {
    console.log('[CommManager] Attempting WebSocket connection...');
    
    this.websocketClient = new WebSocketClient({
      url: WEBSOCKET_CONFIG.url,
      deviceId: this.getDeviceId(),
      authToken: WEBSOCKET_CONFIG.authToken,
      autoReconnect: WEBSOCKET_CONFIG.autoReconnect,
      reconnectInterval: WEBSOCKET_CONFIG.reconnectInterval,
      maxReconnectAttempts: WEBSOCKET_CONFIG.maxReconnectAttempts,
      heartbeatInterval: WEBSOCKET_CONFIG.heartbeatInterval,
      connectionTimeout: WEBSOCKET_CONFIG.connectionTimeout,
      enableSecureMode: WEBSOCKET_CONFIG.enableSecureMode
    });

    // Register connection status handler
    this.websocketClient.onConnectionStatus((status: ConnectionStatus) => {
      this.handleConnectionStatusChange(status);
    });

    // Register telemetry message handler
    this.websocketClient.on(MessageType.TELEMETRY, (message: WebSocketMessage) => {
      this.handleTelemetryMessage(message as TelemetryMessage);
    });

    // Start fallback timer
    this.startFallbackTimer();

    // Connect
    this.websocketClient.connect();
  }

  /**
   * Handle WebSocket connection status changes
   */
  private handleConnectionStatusChange(status: ConnectionStatus): void {
    console.log('[CommManager] Connection status:', status);

    if (status.state === ConnectionState.CONNECTED) {
      // WebSocket connected successfully
      this.clearFallbackTimer();
      this.switchMode(CommunicationMode.WEBSOCKET);
      this.connectionAttempts = 0;
      
      if (FALLBACK_CONFIG.notifyFallbackMode) {
        createToast('WebSocket connected - Real-time mode active', 'success');
      }
    } else if (status.state === ConnectionState.ERROR || status.state === ConnectionState.DISCONNECTED) {
      // WebSocket failed
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= 3 && FALLBACK_CONFIG.enableFirebaseFallback) {
        this.switchToFirebaseFallback();
      }
    } else if (status.state === ConnectionState.RECONNECTING) {
      console.log(`[CommManager] Reconnecting... attempt ${status.reconnectAttempt}`);
    }
  }

  /**
   * Start fallback timer
   */
  private startFallbackTimer(): void {
    if (this.fallbackTimer !== null) {
      return;
    }

    this.fallbackTimer = window.setTimeout(() => {
      if (this.currentMode === CommunicationMode.WEBSOCKET && 
          !this.websocketClient?.isConnected()) {
        console.log('[CommManager] WebSocket connection timeout, switching to fallback');
        this.switchToFirebaseFallback();
      }
    }, FALLBACK_CONFIG.fallbackTimeout);
  }

  /**
   * Clear fallback timer
   */
  private clearFallbackTimer(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  /**
   * Switch to Firebase fallback mode
   */
  private switchToFirebaseFallback(): void {
    console.log('[CommManager] Switching to Firebase fallback mode');
    this.clearFallbackTimer();
    this.switchMode(CommunicationMode.FIREBASE);
    
    if (FALLBACK_CONFIG.notifyFallbackMode) {
      createToast('WebSocket unavailable - Using Firebase fallback mode', 'info');
    }

    // Start Firebase polling if available
    if (this.isFirebaseAvailable) {
      this.startFirebasePolling();
    }
  }

  /**
   * Switch communication mode
   */
  private switchMode(mode: CommunicationMode): void {
    if (this.currentMode === mode) {
      return;
    }

    console.log(`[CommManager] Switching mode from ${this.currentMode} to ${mode}`);
    this.currentMode = mode;

    // Notify mode change callbacks
    this.modeChangeCallbacks.forEach(callback => {
      try {
        callback(mode);
      } catch (error) {
        console.error('[CommManager] Mode change callback error:', error);
      }
    });
  }

  /**
   * Handle telemetry message from WebSocket
   */
  private handleTelemetryMessage(message: TelemetryMessage): void {
    const telemetryData: TelemetryData = {
      ...message.payload,
      severity: this.calculateSeverity(message.payload),
      province: message.payload.device_id // Will be mapped to province if needed
    };

    this.lastTelemetry = telemetryData;

    // Notify telemetry callbacks
    this.telemetryCallbacks.forEach(callback => {
      try {
        callback(telemetryData);
      } catch (error) {
        console.error('[CommManager] Telemetry callback error:', error);
      }
    });
  }

  /**
   * Handle telemetry data from Firebase
   */
  public handleFirebaseTelemetry(data: any): void {
    if (!this.isFirebaseAvailable) {
      this.isFirebaseAvailable = true;
    }

    const telemetryData: TelemetryData = {
      temperature: data.temperature_2m,
      humidity: data.relative_humidity_2m,
      uv_index: data.uv_index,
      wind_speed: data.wind_speed_10m,
      wind_gusts: data.wind_gusts_10m,
      precipitation: data.precipitation,
      weather_code: data.weather_code,
      river_discharge: data.river_discharge,
      severity: data.severity || 'NORMAL',
      province: data.province
    };

    // If in hybrid mode, merge with WebSocket data
    if (this.currentMode === CommunicationMode.HYBRID && this.lastTelemetry) {
      Object.assign(telemetryData, this.lastTelemetry);
    }

    this.lastTelemetry = telemetryData;

    // Notify telemetry callbacks
    this.telemetryCallbacks.forEach(callback => {
      try {
        callback(telemetryData);
      } catch (error) {
        console.error('[CommManager] Telemetry callback error:', error);
      }
    });
  }

  /**
   * Start Firebase polling for fallback mode
   */
  private startFirebasePolling(): void {
    // This will be handled by the existing Firebase client
    // The polling interval is already configured in Firebase client
    console.log('[CommManager] Firebase polling active');
  }

  /**
   * Register telemetry callback
   */
  public onTelemetry(callback: (data: TelemetryData) => void): void {
    this.telemetryCallbacks.add(callback);
  }

  /**
   * Unregister telemetry callback
   */
  public offTelemetry(callback: (data: TelemetryData) => void): void {
    this.telemetryCallbacks.delete(callback);
  }

  /**
   * Register mode change callback
   */
  public onModeChange(callback: (mode: CommunicationMode) => void): void {
    this.modeChangeCallbacks.add(callback);
  }

  /**
   * Unregister mode change callback
   */
  public offModeChange(callback: (mode: CommunicationMode) => void): void {
    this.modeChangeCallbacks.delete(callback);
  }

  /**
   * Get current communication mode
   */
  public getMode(): CommunicationMode {
    return this.currentMode;
  }

  /**
   * Get WebSocket client (for sending commands)
   */
  public getWebSocketClient(): WebSocketClient | null {
    return this.websocketClient;
  }

  /**
   * Check if WebSocket is connected
   */
  public isWebSocketConnected(): boolean {
    return this.websocketClient?.isConnected() || false;
  }

  /**
   * Get last received telemetry
   */
  public getLastTelemetry(): TelemetryData | null {
    return this.lastTelemetry;
  }

  /**
   * Force reconnection to WebSocket
   */
  public reconnectWebSocket(): void {
    if (this.websocketClient) {
      this.connectionAttempts = 0;
      this.websocketClient.disconnect();
      this.websocketClient.connect();
      this.startFallbackTimer();
    }
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    this.clearFallbackTimer();
    if (this.websocketClient) {
      this.websocketClient.disconnect();
      this.websocketClient = null;
    }
    this.telemetryCallbacks.clear();
    this.modeChangeCallbacks.clear();
  }

  /**
   * Get device ID from URL or config
   */
  private getDeviceId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('device') || 
           (import.meta.env as any).VITE_DEVICE_ID || 
           (window as any).SMART_BUILDING_DEVICE_ID || 
           "smart_building_001";
  }

  /**
   * Calculate severity from telemetry data
   */
  private calculateSeverity(payload: any): string {
    const uv = payload.uv_index || 0;
    const apparent = payload.apparent_temperature || payload.temperature || 0;
    const gust = payload.wind_gusts || 0;
    const rain = payload.precipitation || 0;
    const wmo = payload.weather_code || 0;

    if (uv >= 11.0 || apparent >= 41.0 || gust >= 89.0 || rain >= 35.0 || wmo === 96 || wmo === 99) {
      return "CRITICAL";
    } else if (uv >= 8.0 || apparent >= 37.0 || gust >= 50.0 || rain >= 10.0 || wmo === 95) {
      return "WARNING";
    }
    return "NORMAL";
  }
}

// Singleton instance
let communicationManagerInstance: CommunicationManager | null = null;

export const getCommunicationManager = (): CommunicationManager => {
  if (!communicationManagerInstance) {
    communicationManagerInstance = new CommunicationManager();
  }
  return communicationManagerInstance;
};
