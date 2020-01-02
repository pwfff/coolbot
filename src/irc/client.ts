import { IRCConnection, IRCConnectionOptions } from './connection';
import { EventEmitter } from 'events';
import { IRCMessage } from './message';

export type IRCClientOptions = {
  commandPrefix: string;
  name: string;
  password?: string;
  channels?: string[];
  user: {
    nickname: string;
    username?: string;
    realname?: string;
  };
  connection: IRCConnectionOptions;
  plugins?: {
    config?: { [key: string]: any };
    whitelist?: string[];
    blacklist?: string[];
  };
};

type ConnectionHandler = (...args: any[]) => void;

export class IRCClient extends EventEmitter {
  private connection: IRCConnection | null = null;
  private connectionHandlers: ConnectionHandler[] = [];

  constructor(public options: IRCClientOptions) {
    super();
  }

  connect() {
    this.cleanupConnection();

    this.connection = new IRCConnection(this.options.connection);

    this.bindConnectionEvent('connected', () => {
      this.emit('connected');
      this.registerClient();
    });

    this.bindConnectionEvent('raw', line => {
      this.emit('raw', line);
    });

    this.bindConnectionEvent('sent', line => {
      this.emit('sent', line);
    });

    this.bindConnectionEvent('error', (error: Error) => {
      this.emit('error', error);
    });

    this.bindConnectionEvent('reconnecting', (length: number) => {
      this.emit('reconnecting', length);
    });

    this.bindConnectionEvent('line', (line: IRCMessage) => {
      if (!this.connection) {
        return;
      }

      if (line.command === 'PING') {
        let params = '';

        if (line.params) {
          params = line.params.join(' ');
        }

        this.connection.writeRaw(`PONG ${params}`);
      }

      if (line.command === 'PRIVMSG') {
        const { nick, params } = line;

        if (!params) {
          return;
        }

        const [channel, message] = params;

        this.emit('message', line, nick, channel, message);
      } else {
        this.emit('event', line);
      }
    });

    this.connection.connect();
  }

  write(message: IRCMessage) {
    if (!this.connection) {
      return;
    }

    this.connection.write(message);
  }

  writeRaw(line: string) {
    if (!this.connection) {
      return;
    }

    this.connection.writeRaw(line);
  }

  join(channel: string) {
    if (!this.connection) {
      return;
    }

    this.connection.writeRaw(`JOIN ${channel}`);
  }

  part(channel: string, message = '') {
    if (!this.connection) {
      return;
    }

    this.connection.writeRaw(`PART ${channel} ${message}`);
  }

  message(target: string, message: string) {
    if (!this.connection) {
      return;
    }

    this.connection.writeRaw(`PRIVMSG ${target} :${message}`);
  }

  disconnect() {
    if (!this.connection) {
      return;
    }

    this.connection.disconnect();

    this.cleanupConnection();

    this.emit('disconnected');
  }

  private registerClient() {
    if (!this.connection) {
      return;
    }

    if (this.options.password) {
      this.connection.writeRaw(`PASS ${this.options.password}`);
    }

    const { nickname, username, realname } = this.options.user;

    this.connection.writeRaw(`NICK ${nickname}`);
    this.connection.writeRaw(`USER ${username} 0 * ${realname}`);

    this.emit('registered');

    setTimeout(() => {
      this.options.channels?.forEach(channel => this.join(channel));
    }, 2000);
  }

  private cleanupConnection() {
    if (!this.connection) return;

    this.unbindconnnectionEvents();
    this.connection = null;
  }

  private bindConnectionEvent(event: string, handler: ConnectionHandler) {
    if (!this.connection) return;

    this.connectionHandlers.push(() => {
      this.connection?.off(event, handler);
    });

    this.connection.on(event, (...args) => handler(...args));
  }

  private unbindconnnectionEvents() {
    this.connectionHandlers.forEach(handler => handler());

    this.connectionHandlers = [];
  }
}
