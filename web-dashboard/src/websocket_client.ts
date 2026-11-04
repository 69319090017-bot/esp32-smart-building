/**
 * WebSocket Connection Manager
 * 
 * This module provides a robust WebSocket client with:
 * - Auto-reconnection with exponential backoff
 * - Connection state management
 * - Heartbeat/ping-pong mechanism
 * - Message queue for offline buffering
 * - Connection pooling for multiple devices
 * - Rate limiting and security
 */

import {
  WebSocketMessage,
  MessageType,
  ConnectionState,
  WebSocketOptions,
  ConnectionStatus,
  MessageHandler,
  ConnectionStatusHandler,
  BaseMessage,
  HeartbeatMessage,
  PROTOCOL_VERSION
} from './websocket_types';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketOptions>;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private heartbeatTimer: number | null = null;
  private heartbeatSequence: number = 0;
  private lastHeartbeatTime: number = 0;
  private messageQueue: WebSocketMessage[] = [];
  private messageHandlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private connectionStatusHandlers: Set<ConnectionStatusHandler> = new Set();
  private messageBuffer: string[] = [];
  private maxBufferSize: number = 100;
  private rateLimiter: Map<string, number[]> = new Map();
  private rateLimitWindow: number = 1000; // 1 second
  private rateLimitMax: number = 10; // Max 10 messages per second
  private connectionStartTime: number = 0;
  private latency: number = 0;

  constructor(options: WebSocketOptions) {
    this.options = {
      url: options.url,
      deviceId: options.deviceId,
      authToken: options.authToken || '',
      autoReconnect: options.autoReconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 10000,
      enableSecureMode: options.enableSecureMode ?? true
    };
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.connectionState === ConnectionState.CONNECTING || 
        this.connectionState === ConnectionState.CONNECTED) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    this.connectionState = ConnectionState.CONNECTING;
    this.connectionStartTime = Date.now();
    this.notifyStatusChange({ state: this.connectionState });

    try {
      // Construct WebSocket URL with authentication
      let wsUrl = this.options.url;
      if (this.options.authToken) {
        wsUrl += `?token=${encodeURIComponent(this.options.authToken)}`;
      }
      wsUrl += `&device_id=${encodeURIComponent(this.options.deviceId)}`;

      // Only upgrade to secure sockets when the target is a real TLS endpoint.
      // Local development commonly serves plain HTTP on localhost, where wss:// is not available.
      if (this.options.enableSecureMode && wsUrl.startsWith('ws://')) {
        try {
          const parsed = new URL(wsUrl);
          const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.hostname.endsWith('.localhost');
          const isSecurePage = typeof window !== 'undefined' && window.location.protocol === 'https:';
          if (!isLocalHost && isSecurePage) {
            wsUrl = wsUrl.replace('ws://', 'wss://');
          }
        } catch {
          // Keep the original URL if it cannot be parsed.
        }
      }

      console.log(`[WebSocket] Connecting to ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      // Set connection timeout
      const timeoutTimer = setTimeout(() => {
        if (this.connectionState === ConnectionState.CONNECTING) {
          this.handleConnectionError(new Error('Connection timeout'));
        }
      }, this.options.connectionTimeout);

      this.ws.onopen = () => {
        clearTimeout(timeoutTimer);
        this.handleConnectionOpen();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeoutTimer);
        console.error('[WebSocket] Error:', error);
        this.handleConnectionError(new Error('WebSocket error'));
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeoutTimer);
        this.handleConnectionClose(event.code, event.reason);
      };

    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.options.autoReconnect = false;
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send a message through WebSocket
   */
  public send(message: WebSocketMessage): boolean {
    // Check rate limit
    if (!this.checkRateLimit(message.type)) {
      console.warn('[WebSocket] Rate limit exceeded for message type:', message.type);
      return false;
    }

    // Add required fields
    const messageToSend: BaseMessage = {
      ...message,
      version: PROTOCOL_VERSION,
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    if (this.connectionState === ConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(messageToSend));
        return true;
      } catch (error) {
        console.error('[WebSocket] Send error:', error);
        this.bufferMessage(messageToSend);
        return false;
      }
    } else {
      // Buffer message for when connection is restored
      this.bufferMessage(messageToSend);
      return false;
    }
  }

  /**
   * Register a message handler for a specific message type
   */
  public on(messageType: MessageType, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType)!.add(handler);
  }

  /**
   * Unregister a message handler
   */
  public off(messageType: MessageType, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(messageType);
      }
    }
  }

  /**
   * Register a connection status handler
   */
  public onConnectionStatus(handler: ConnectionStatusHandler): void {
    this.connectionStatusHandlers.add(handler);
  }

  /**
   * Unregister a connection status handler
   */
  public offConnectionStatus(handler: ConnectionStatusHandler): void {
    this.connectionStatusHandlers.delete(handler);
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current latency in milliseconds
   */
  public getLatency(): number {
    return this.latency;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED && 
           this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle connection open event
   */
  private handleConnectionOpen(): void {
    console.log('[WebSocket] Connected successfully');
    this.connectionState = ConnectionState.CONNECTED;
    this.reconnectAttempts = 0;
    this.latency = Date.now() - this.connectionStartTime;
    
    this.notifyStatusChange({ 
      state: this.connectionState,
      latency: this.latency
    });

    // Start heartbeat
    this.startHeartbeat();

    // Send buffered messages
    this.flushMessageBuffer();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // Validate message version
      if (message.version !== PROTOCOL_VERSION) {
        console.warn(`[WebSocket] Version mismatch: expected ${PROTOCOL_VERSION}, got ${message.version}`);
      }

      // Handle heartbeat responses
      if (message.type === MessageType.HEARTBEAT) {
        this.handleHeartbeatResponse(message);
        return;
      }

      // Call registered handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('[WebSocket] Handler error:', error);
          }
        });
      }

    } catch (error) {
      console.error('[WebSocket] Message parse error:', error);
    }
  }

  /**
   * Handle connection close event
   */
  private handleConnectionClose(code: number, reason: string): void {
    console.log(`[WebSocket] Connection closed: ${code} - ${reason}`);
    this.connectionState = ConnectionState.DISCONNECTED;
    this.cleanup();
    
    this.notifyStatusChange({ 
      state: this.connectionState,
      lastError: reason || 'Connection closed'
    });

    // Auto-reconnect if enabled
    if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    console.error('[WebSocket] Connection error:', error);
    this.connectionState = ConnectionState.ERROR;
    
    this.notifyStatusChange({ 
      state: this.connectionState,
      lastError: error.message
    });

    if (this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }

    this.reconnectAttempts++;
    const backoffTime = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`[WebSocket] Reconnecting in ${backoffTime}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
    
    this.connectionState = ConnectionState.RECONNECTING;
    this.notifyStatusChange({ 
      state: this.connectionState,
      reconnectAttempt: this.reconnectAttempts
    });

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoffTime);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendHeartbeat();
      } else {
        this.stopHeartbeat();
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat message
   */
  private sendHeartbeat(): void {
    const heartbeat: HeartbeatMessage = {
      version: PROTOCOL_VERSION,
      type: MessageType.HEARTBEAT,
      timestamp: Date.now(),
      id: this.generateMessageId(),
      payload: {
        sequence: ++this.heartbeatSequence
      }
    };
    
    this.lastHeartbeatTime = Date.now();
    this.send(heartbeat);
  }

  /**
   * Handle heartbeat response
   */
  private handleHeartbeatResponse(message: WebSocketMessage): void {
    const now = Date.now();
    this.latency = now - this.lastHeartbeatTime;
    this.lastHeartbeatTime = now;
    
    // Update status with new latency
    this.notifyStatusChange({ 
      state: this.connectionState,
      latency: this.latency
    });
  }

  /**
   * Buffer message for offline storage
   */
  private bufferMessage(message: BaseMessage): void {
    if (this.messageBuffer.length >= this.maxBufferSize) {
      this.messageBuffer.shift(); // Remove oldest message
    }
    this.messageBuffer.push(JSON.stringify(message));
    console.log(`[WebSocket] Message buffered (${this.messageBuffer.length}/${this.maxBufferSize})`);
  }

  /**
   * Flush buffered messages when connection is restored
   */
  private flushMessageBuffer(): void {
    if (this.messageBuffer.length === 0) {
      return;
    }

    console.log(`[WebSocket] Flushing ${this.messageBuffer.length} buffered messages`);
    
    while (this.messageBuffer.length > 0 && this.isConnected()) {
      const messageStr = this.messageBuffer.shift();
      if (messageStr) {
        try {
          this.ws!.send(messageStr);
        } catch (error) {
          console.error('[WebSocket] Error sending buffered message:', error);
          // Put message back at front of queue
          this.messageBuffer.unshift(messageStr);
          break;
        }
      }
    }
  }

  /**
   * Check rate limit for message type
   */
  private checkRateLimit(messageType: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimiter.get(messageType) || [];
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < this.rateLimitWindow);
    
    if (validTimestamps.length >= this.rateLimitMax) {
      return false;
    }
    
    validTimestamps.push(now);
    this.rateLimiter.set(messageType, validTimestamps);
    return true;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Notify all connection status handlers
   */
  private notifyStatusChange(status: ConnectionStatus): void {
    this.connectionStatusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('[WebSocket] Status handler error:', error);
      }
    });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${this.options.deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Connection pool for managing multiple device connections
 */
export class WebSocketConnectionPool {
  private connections: Map<string, WebSocketClient> = new Map();

  /**
   * Get or create a connection for a device
   */
  public getConnection(deviceId: string, options: WebSocketOptions): WebSocketClient {
    let client = this.connections.get(deviceId);
    
    if (!client) {
      client = new WebSocketClient({ ...options, deviceId });
      this.connections.set(deviceId, client);
    }
    
    return client;
  }

  /**
   * Remove a connection from the pool
   */
  public removeConnection(deviceId: string): void {
    const client = this.connections.get(deviceId);
    if (client) {
      client.disconnect();
      this.connections.delete(deviceId);
    }
  }

  /**
   * Get all active connections
   */
  public getConnections(): Map<string, WebSocketClient> {
    return this.connections;
  }

  /**
   * Disconnect all connections
   */
  public disconnectAll(): void {
    this.connections.forEach((client) => {
      client.disconnect();
    });
    this.connections.clear();
  }
}
