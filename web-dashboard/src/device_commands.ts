/**
 * Device Command Queue and Handling
 * 
 * This module provides:
 * - Command queue for ESP32 device control
 * - Command acknowledgment and retry logic
 * - Command history and status tracking
 * - Timeout handling for unacknowledged commands
 */

import {
  WebSocketMessage,
  MessageType,
  CommandType,
  CommandMessage,
  AckMessage,
  QueuedCommand,
  WebSocketClient
} from './websocket_types';

export interface CommandResult {
  success: boolean;
  commandId: string;
  result?: any;
  error?: string;
}

export class DeviceCommandQueue {
  private queue: Map<string, QueuedCommand> = new Map();
  private websocketClient: WebSocketClient | null = null;
  private defaultTimeout: number = 5000; // 5 seconds default timeout
  private maxRetries: number = 3;
  private commandHistory: CommandResult[] = [];
  private maxHistorySize: number = 100;
  private pendingCommands: Set<string> = new Set();

  constructor(websocketClient?: WebSocketClient) {
    this.websocketClient = websocketClient || null;
  }

  /**
   * Set the WebSocket client for sending commands
   */
  public setWebSocketClient(client: WebSocketClient): void {
    this.websocketClient = client;
  }

  /**
   * Send a command to the device
   */
  public sendCommand(
    command: CommandType,
    params?: Record<string, any>,
    options?: {
      timeout?: number;
      maxRetries?: number;
      callback?: (success: boolean, result?: any) => void;
    }
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const commandId = this.generateCommandId();
      const timeout = options?.timeout || this.defaultTimeout;
      const maxRetries = options?.maxRetries || this.maxRetries;

      const queuedCommand: QueuedCommand = {
        id: commandId,
        command,
        params,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries,
        timeout,
        status: 'pending',
        callback: (success, result) => {
          // Record in history
          this.recordCommandHistory({
            success,
            commandId,
            result: success ? result : undefined,
            error: success ? undefined : (result as string)
          });
          
          // Call user callback if provided
          if (options?.callback) {
            options.callback(success, result);
          }
          
          // Resolve promise
          resolve({
            success,
            commandId,
            result: success ? result : undefined,
            error: success ? undefined : (result as string)
          });
        }
      };

      this.queue.set(commandId, queuedCommand);
      this.pendingCommands.add(commandId);

      // Send the command
      this.sendCommandMessage(queuedCommand);

      // Set timeout for acknowledgment
      this.setCommandTimeout(queuedCommand);
    });
  }

  /**
   * Handle acknowledgment from device
   */
  public handleAck(ackMessage: AckMessage): void {
    const commandId = ackMessage.payload.command_id;
    const queuedCommand = this.queue.get(commandId);

    if (!queuedCommand) {
      console.warn(`[CommandQueue] No pending command found for ack: ${commandId}`);
      return;
    }

    if (ackMessage.payload.success) {
      queuedCommand.status = 'acknowledged';
      this.pendingCommands.delete(commandId);
      this.queue.delete(commandId);
      
      if (queuedCommand.callback) {
        queuedCommand.callback(true, ackMessage.payload.result);
      }
    } else {
      // Command failed on device side
      queuedCommand.status = 'failed';
      this.pendingCommands.delete(commandId);
      this.queue.delete(commandId);
      
      if (queuedCommand.callback) {
        queuedCommand.callback(false, ackMessage.payload.message || 'Command failed on device');
      }
    }
  }

  /**
   * Retry a failed command
   */
  private retryCommand(queuedCommand: QueuedCommand): void {
    if (queuedCommand.retryCount >= queuedCommand.maxRetries) {
      queuedCommand.status = 'timeout';
      this.pendingCommands.delete(queuedCommand.id);
      this.queue.delete(queuedCommand.id);
      
      if (queuedCommand.callback) {
        queuedCommand.callback(false, 'Command timeout after max retries');
      }
      return;
    }

    queuedCommand.retryCount++;
    queuedCommand.timestamp = Date.now();
    queuedCommand.status = 'pending';

    console.log(`[CommandQueue] Retrying command ${queuedCommand.id} (attempt ${queuedCommand.retryCount}/${queuedCommand.maxRetries})`);
    
    this.sendCommandMessage(queuedCommand);
    this.setCommandTimeout(queuedCommand);
  }

  /**
   * Send command message through WebSocket
   */
  private sendCommandMessage(queuedCommand: QueuedCommand): void {
    if (!this.websocketClient || !this.websocketClient.isConnected()) {
      console.warn('[CommandQueue] WebSocket not connected, command will be buffered');
    }

    const commandMessage: CommandMessage = {
      version: '1.0.0',
      type: MessageType.COMMAND,
      timestamp: Date.now(),
      id: queuedCommand.id,
      payload: {
        command: queuedCommand.command,
        params: queuedCommand.params,
        retry_count: queuedCommand.retryCount
      }
    };

    if (this.websocketClient) {
      this.websocketClient.send(commandMessage);
    }
  }

  /**
   * Set timeout for command acknowledgment
   */
  private setCommandTimeout(queuedCommand: QueuedCommand): void {
    setTimeout(() => {
      const currentCommand = this.queue.get(queuedCommand.id);
      
      if (currentCommand && currentCommand.status === 'pending') {
        console.log(`[CommandQueue] Command ${queuedCommand.id} timed out`);
        this.retryCommand(currentCommand);
      }
    }, queuedCommand.timeout);
  }

  /**
   * Record command in history
   */
  private recordCommandHistory(result: CommandResult): void {
    this.commandHistory.push(result);
    
    // Trim history if too large
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    }
  }

  /**
   * Get command history
   */
  public getCommandHistory(): CommandResult[] {
    return [...this.commandHistory];
  }

  /**
   * Get pending commands
   */
  public getPendingCommands(): QueuedCommand[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get command count by status
   */
  public getCommandStats(): {
    total: number;
    pending: number;
    successful: number;
    failed: number;
  } {
    const successful = this.commandHistory.filter(h => h.success).length;
    const failed = this.commandHistory.filter(h => !h.success).length;
    
    return {
      total: this.commandHistory.length,
      pending: this.queue.size,
      successful,
      failed
    };
  }

  /**
   * Clear command history
   */
  public clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Cancel a pending command
   */
  public cancelCommand(commandId: string): boolean {
    const command = this.queue.get(commandId);
    if (command && command.status === 'pending') {
      command.status = 'failed';
      this.pendingCommands.delete(commandId);
      this.queue.delete(commandId);
      
      if (command.callback) {
        command.callback(false, 'Command cancelled by user');
      }
      
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending commands
   */
  public cancelAllCommands(): void {
    const commandIds = Array.from(this.queue.keys());
    commandIds.forEach(id => this.cancelCommand(id));
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Device-specific command helpers
 */
export class DeviceCommands {
  private commandQueue: DeviceCommandQueue;

  constructor(commandQueue: DeviceCommandQueue) {
    this.commandQueue = commandQueue;
  }

  /**
   * Toggle strobe relay
   */
  public async toggleStrobe(): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.TOGGLE_STROBE);
  }

  /**
   * Toggle emergency door
   */
  public async toggleDoor(): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.TOGGLE_DOOR);
  }

  /**
   * Silence alarm
   */
  public async silenceAlarm(): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.SILENCE_ALARM);
  }

  /**
   * Test siren
   */
  public async testSiren(): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.TEST_SIREN);
  }

  /**
   * Set device configuration
   */
  public async setConfig(configKey: string, configValue: any): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.SET_CONFIG, {
      key: configKey,
      value: configValue
    });
  }

  /**
   * Reboot device
   */
  public async rebootDevice(): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.REBOOT_DEVICE, undefined, {
      timeout: 10000, // Longer timeout for reboot
      maxRetries: 1 // Don't retry reboot
    });
  }

  /**
   * Get device status
   */
  public async getStatus(): Promise<CommandResult> {
    return this.commandQueue.sendCommand(CommandType.GET_STATUS);
  }

  /**
   * Get command queue statistics
   */
  public getStats() {
    return this.commandQueue.getCommandStats();
  }

  /**
   * Get command history
   */
  public getHistory() {
    return this.commandQueue.getCommandHistory();
  }
}
