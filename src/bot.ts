import { EventEmitter } from 'events';

import chokidar from 'chokidar';
import decache from 'decache';

import { IRCClientOptions, IRCClient } from './irc/client';
import { IRCClientManager } from './irc/manager';
import { IRCMessage } from './irc/message';
import path from 'path';

export interface BotConfig {
  irc?: {
    clients: IRCClientOptions[];
  };
}

export type RegisterHandler = (handlers: {
  registerFilter(handler: FilterHandler): void;
  registerCommand(handler: CommandHandler): void;
  registerEventHandler(handler: EventHandler): void;
  registerRegexHandler(handler: RegexHandler): void;
}) => void;

type Protocol = 'irc';

type Message = IRCMessage | null;

type FilterHandler = {
  name: string;
  handler: (message: Message, context?: { [key: string]: any }) => Message;
};

type FilterCollection = {
  irc: FilterHandler[];
};

export type CommandHandlerCallback = (
  context: IRCContext,
  message: IRCMessage,
  input: string,
  config: BotConfig,
) => void;

export type CommandHandler = {
  name: string;
  aliases?: string[];
  handler: CommandHandlerCallback;
};

type CommandCollection = {
  irc: { [name: string]: CommandHandler };
};

export type RegexHandlerCallback = (
  context: IRCContext,
  message: IRCMessage,
  config: BotConfig,
) => void;

export type RegexHandler = {
  name: string;
  regex: RegExp;
  handler: RegexHandlerCallback;
};

type RegexCollection = {
  irc: { [name: string]: RegexHandler };
};

export type EventHandlerCallback = (
  context: IRCContext,
  event: IRCMessage,
  config: BotConfig,
) => void;

export type EventHandler = {
  name: string;
  event: string;
  handler: EventHandlerCallback;
};

type EventHandlerCollection = {
  irc: { [name: string]: EventHandler };
};

type IRCContext = {
  sendMessage: (target: string, message: string) => void;
  respond: (contents: string) => void;
  sendRaw: (line: string) => void;
  options: IRCClientOptions;
};

export class Bot extends EventEmitter {
  private IRCManager: IRCClientManager;
  private filters: FilterCollection = {
    irc: [],
  };
  private commands: CommandCollection = {
    irc: {},
  };
  private regexes: RegexCollection = {
    irc: {},
  };
  private eventHandlers: EventHandlerCollection = {
    irc: {},
  };

  constructor(private config: BotConfig) {
    super();

    this.IRCManager = new IRCClientManager();

    if (config.irc) {
      config.irc.clients.forEach(client => this.IRCManager.addClient(client));
    }

    this.registerIRCHandlers();

    this.watchPlugins();
  }

  start() {
    if (this.IRCManager) {
      this.IRCManager.start();
    }
  }

  stop() {
    if (this.IRCManager) {
      this.IRCManager.stop();
    }
  }

  registerFilter(handler: FilterHandler) {
    console.log('[+] Registered Filter: ', handler.name);

    this.filters.irc.push(handler);
  }

  registerCommand(handler: CommandHandler) {
    console.log('[+] Registered Command Handler: ', handler.name);

    this.commands.irc[handler.name] = handler;

    if (handler.aliases) {
      handler.aliases.forEach(alias => (this.commands.irc[alias] = handler));
    }
  }

  registerEventHandler(handler: EventHandler) {
    console.log('[+] Registered Event Handler: ', handler.name);

    this.eventHandlers.irc[handler.name] = handler;
  }

  registerRegex(handler: RegexHandler) {
    console.log('[+] Registered Regex Handler: ', handler.name);

    this.regexes.irc[handler.name] = handler;
  }

  private filterMessage(type: Protocol, message: Message): Message {
    const filters = this.filters.irc;

    const filteredMessage = filters.reduce((m: Message, filter) => {
      return message === null ? message : filter.handler(m);
    }, message);

    return filteredMessage;
  }

  private handleMessage(
    type: Protocol,
    context: IRCContext,
    message: IRCMessage,
  ) {
    const { params, command } = message;

    const options = context.options;

    const hasBlacklist = !!options.plugins?.blacklist;
    const hasWhitelist = !!options.plugins?.whitelist;

    const isWhitelisted = (name: string): boolean => {
      return !!(
        options.plugins?.whitelist &&
        options.plugins.whitelist.length > 0 &&
        options.plugins.whitelist.indexOf(name) >= 0
      );
    };

    const isBlacklisted = (name: string): boolean => {
      return !!(
        options.plugins?.blacklist &&
        options.plugins.blacklist.length > 0 &&
        options.plugins.blacklist.indexOf(name) === -1
      );
    };

    if (command !== 'PRIVMSG') {
      Object.keys(this.eventHandlers.irc).forEach(key => {
        const handler = this.eventHandlers.irc[key];

        if (
          ((hasWhitelist && !isWhitelisted(handler.name)) ||
            (hasBlacklist && isBlacklisted(handler.name)) ||
            (!hasBlacklist && !hasWhitelist)) &&
          command?.toUpperCase() === handler.event.toUpperCase()
        ) {
          handler.handler(context, message, this.config);
        }
      });

      return;
    }

    if (!params) return;

    const prefix = params[1].charAt(0);
    const isCommand = prefix === options.commandPrefix;

    const commandName = params[1].split(' ')[0].substr(1);
    const commandHandler = this.commands.irc[commandName];

    if (!isCommand || !commandHandler) {
      Object.keys(this.regexes.irc).forEach(key => {
        const regex = this.regexes.irc[key];

        const matches = regex.regex.test(params[1]);

        if (
          matches &&
          ((hasWhitelist && !isWhitelisted(regex.name)) ||
            (hasBlacklist && isBlacklisted(regex.name)) ||
            (!hasBlacklist && !hasWhitelist))
        ) {
          regex.handler(context, message, this.config);
        }
      });
    }

    if (isCommand && this.commands.irc[commandName]) {
      if (hasWhitelist && !isWhitelisted(commandName)) return;
      if (hasBlacklist && isBlacklisted(commandName)) return;

      // command + prefix + space
      const input = params[1].slice(commandName.length + 2);

      this.commands.irc[commandName].handler(
        context,
        message,
        input,
        this.config,
      );
    }
  }

  private createIRCContext(
    client: IRCClient,
    message?: IRCMessage,
  ): IRCContext {
    const sendMessage = (target: string, message: string) => {
      const ircMessage = new IRCMessage();

      ircMessage.command = 'PRIVMSG';
      ircMessage.params = [target, message];

      const filteredMessage = this.filterMessage('irc', ircMessage);

      if (filteredMessage) {
        client.write(filteredMessage);
      }
    };

    const respond = (contents: string) => {
      if (!message || !message.params) return;

      const ircMessage = new IRCMessage();

      ircMessage.command = 'PRIVMSG';
      ircMessage.params = [message.params[0], contents];

      const filteredMessage = this.filterMessage('irc', ircMessage);

      if (filteredMessage) {
        client.write(filteredMessage);
      }
    };

    const sendRaw = (line: string) => {
      const message = IRCMessage.fromLine(line);

      if (!message) {
        return;
      }

      const filteredMessage = this.filterMessage('irc', message);

      if (filteredMessage) {
        client.write(filteredMessage);
      }
    };

    const options = client.options;

    const wrapper: IRCContext = {
      sendMessage: sendMessage.bind(this),
      sendRaw: sendRaw.bind(this),
      respond: respond.bind(this),
      options,
    };

    return wrapper;
  }

  private watchPlugins() {
    const folderPath = path.join(__dirname, 'plugins');
    const pluginFolder = chokidar.watch(folderPath, {
      persistent: true,
    });

    const handlers = {
      registerFilter: this.registerFilter.bind(this),
      registerCommand: this.registerCommand.bind(this),
      registerEventHandler: this.registerEventHandler.bind(this),
      registerRegexHandler: this.registerRegex.bind(this),
    };

    pluginFolder
      .on('add', (fileName: string) => {
        const m = require(fileName);

        if (m.register) {
          m.register(handlers);
        }
      })
      .on('change', (fileName: string) => {
        decache(fileName);

        const m = require(fileName);

        if (m.register) {
          m.register(handlers);
        }
      });
  }

  private registerIRCHandlers() {
    this.IRCManager.on('message', (client: IRCClient, message: IRCMessage) => {
      const context = this.createIRCContext(client, message);

      this.handleMessage('irc', context, message);
    });

    this.IRCManager.on('event', (client: IRCClient, event: IRCMessage) => {
      const context = this.createIRCContext(client, event);

      this.handleMessage('irc', context, event);
    });

    this.IRCManager.on('sent', (client: IRCClient, line: string) => {
      console.log('>> ' + line);
    });

    this.IRCManager.on('raw', (client: IRCClient, line: string) => {
      console.log('<< ' + line);
    });
  }
}
