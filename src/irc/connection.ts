import { EventEmitter } from 'events';
import * as net from 'net';
import * as tls from 'tls';

import { IRCMessage } from './message';

export type IRCConnectionOptions = {
  host: string;
  port: number;
  auto_reconnect?: boolean;
  tls?: boolean;
};

type ConnectionHandler = (...args: any[]) => void;

export class IRCConnection extends EventEmitter {
  private socket: net.Socket | null = null;
  private socketHandlers: ConnectionHandler[] = [];
  private reconnecting = false;

  constructor(public options: IRCConnectionOptions) {
    super();
  }

  connect() {
    this.cleanupSocket();

    this.emit('connecting');

    if (this.options.tls) {
      this.socket = tls.connect({
        host: this.options.host,
        port: this.options.port,
        rejectUnauthorized: false,
      });

      this.bindSocketEvent('secureConnect', () => this.onConnect());
    } else {
      this.socket = net.connect({
        host: this.options.host,
        port: this.options.port,
      });

      this.bindSocketEvent('connect', () => this.onConnect());
    }

    this.socket.setEncoding('utf8');

    this.bindSocketEvent('data', (buffer: Buffer) => this.onData(buffer));
    this.bindSocketEvent('close', () => this.onClose());
    this.bindSocketEvent('end', () => this.onEnd());
    this.bindSocketEvent('error', (error: Error) => this.onError(error));
  }

  disconnect() {
    this.cleanupSocket();

    this.emit('disconnected');
  }

  write(message: IRCMessage) {
    if (!this.socket) {
      return;
    }

    const line = message.toLine();

    this.emit('sent', line);

    const buffer = Buffer.from(line + '\r\n', 'utf8');

    this.socket.write(buffer);
  }

  writeRaw(line: string) {
    if (!this.socket) {
      return;
    }

    this.emit('sent', line);

    const buffer = Buffer.from(line + '\r\n', 'utf8');

    this.socket.write(buffer);
  }

  private onData(buffer: Buffer) {
    const lines = buffer.toString('utf8').split('\r\n');

    lines.forEach(line => {
      this.emit('raw', line);

      const message = IRCMessage.fromLine(line);

      if (!message) return;

      this.emit('line', message);
    });
  }

  private onConnect() {
    this.emit('connected');
  }

  private onEnd() {
    this.emit('end');

    this.disconnect();

    if (this.options.auto_reconnect) {
      this.handleReconnect();
    }
  }

  private onClose() {
    this.emit('close');

    this.disconnect();

    if (this.options.auto_reconnect) {
      this.handleReconnect();
    }
  }

  private onError(error: Error) {
    this.emit('error', error);
  }

  private cleanupSocket() {
    if (!this.socket) return;

    this.socket.destroy();

    this.unbindSocketEvents();

    this.socket = null;
  }

  private bindSocketEvent(event: string, handler: ConnectionHandler) {
    if (!this.socket) return;

    this.socketHandlers.push(() => {
      this.socket?.off(event, handler);
    });

    this.socket.on(event, (...args) => handler(...args));
  }

  private unbindSocketEvents() {
    this.socketHandlers.forEach(handler => handler());

    this.socketHandlers = [];
  }

  private handleReconnect() {
    if (this.reconnecting) {
      return;
    }

    this.emit('reconnecting', 30);

    this.reconnecting = true;

    setTimeout(() => {
      this.reconnecting = false;
      this.connect();
    }, 30000);
  }
}
