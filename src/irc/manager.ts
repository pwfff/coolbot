import { EventEmitter } from 'events';

import { IRCClientOptions, IRCClient } from './client';
import { IRCMessage } from './message';

type ClientCollection = { [name: string]: IRCClient };

export class IRCClientManager extends EventEmitter {
  clients: ClientCollection = {};

  constructor(clientOptions: IRCClientOptions[] = []) {
    super();

    clientOptions.forEach(c => this.addClient(c));
  }

  addClient(options: IRCClientOptions) {
    const client = new IRCClient(options);

    client.on('raw', (line: string) => {
      this.emit('raw', client, line);
    });

    client.on('event', (event: IRCMessage) => {
      this.emit('event', client, event);
    });

    client.on('message', (message: IRCMessage) => {
      this.emit('event', client, message);
    });

    client.on('sent', (line: string) => {
      this.emit('sent', client, line);
    });

    client.on('registered', () => {
      this.emit('registered', client);
    });

    client.on('connected', () => {
      this.emit('connected', client);
    });

    this.clients[client.options.name] = client;
  }

  start() {
    Object.values(this.clients).forEach(connection => connection.connect());
  }

  stop() {
    Object.values(this.clients).forEach(connection => connection.disconnect());
  }

  disconnect(target: string) {
    const client = this.clients[target];

    if (!client) {
      return;
    }

    this.clients[target].disconnect();
  }
}

export default new IRCClientManager();
