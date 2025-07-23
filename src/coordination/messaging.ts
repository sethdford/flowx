/**
 * Coordination Messaging System
 * Handles communication between coordination components
 */

import { EventEmitter } from 'node:events';
import { Logger } from '../core/logger.js';

export interface CoordinationMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
  target?: string;
}

export class CoordinationMessaging extends EventEmitter {
  private logger: Logger;
  private messageQueue: CoordinationMessage[] = [];

  constructor() {
    super();
    this.logger = new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'CoordinationMessaging' }
    );
  }

  async sendMessage(message: CoordinationMessage): Promise<void> {
    this.messageQueue.push(message);
    this.emit('message', message);
  }

  getMessages(): CoordinationMessage[] {
    return this.messageQueue;
  }
} 