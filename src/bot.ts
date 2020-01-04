import { EventEmitter } from 'events';
import path from 'path';

import chokidar from 'chokidar';
import PouchDB from 'pouchdb';

import decache from './util/decache';
import { IRCClientOptions, IRCClient, ChannelConfig } from './irc/client';
import { IRCClientManager } from './irc/manager';
import { IRCMessage } from './irc/message';

export interface BotConfig {
  clients: {
    irc: IRCClientOptions[];
  };
  config: { [key: string]: any };
}

export type RegisterHandler = (handlers: {
  registerFilter(handler: FilterHandler): void;
  registerCommand(handler: CommandHandler): void;
  registerEventHandler(handler: EventHandler): void;
  registerRegexHandler(handler: RegexHandler): void;
}) => void;

type Protocol = 'irc';

type Message = IRCMessage | null;

type FilterHandlerCallback = (
  message: Message,
  context?: { [key: string]: any },
) => Message;

type FilterHandler = {
  name: string;
  handler: FilterHandlerCallback;
};

type FilterCollection = {
  irc: FilterHandler[];
};

export type CommandHandlerCallback = (
  context: IRCContext,
  message: IRCMessage,
  input: string,
  client: IRCClientOptions,
  config: Record<string, any>,
) => Promise<void>;

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
  client: IRCClientOptions,
  config: Record<string, any>,
) => Promise<void>;

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
  client: IRCClientOptions,
  config: Record<string, any>,
) => Promise<void>;

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
  database: PouchDB.Database;
  options: IRCClientOptions;
};

export class Bot extends EventEmitter {
  private database: PouchDB.Database;
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

    this.database = new PouchDB('coolbot');

    this.IRCManager = new IRCClientManager();

    if (config.clients.irc) {
      config.clients.irc.forEach(client => this.IRCManager.addClient(client));
    }

    this.registerIRCHandlers().then(() => {
      this.watchPlugins();
    });
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

  private async handleMessage(
    type: Protocol,
    context: IRCContext,
    message: IRCMessage,
  ) {
    const { params, command } = message;

    const options = context.options;

    const hasGlobalBlacklist = !!options.plugins?.blacklist;
    const hasGlobalWhitelist = !!options.plugins?.whitelist;

    const isGlobalWhitelisted = (name: string): boolean => {
      return !!(
        options.plugins?.whitelist &&
        options.plugins.whitelist.length > 0 &&
        options.plugins.whitelist.indexOf(name) >= 0
      );
    };

    const isGlobalBlacklisted = (name: string): boolean => {
      return !!(
        options.plugins?.blacklist &&
        options.plugins.blacklist.length > 0 &&
        options.plugins.blacklist.indexOf(name) === -1
      );
    };

    // Check channel and server level permissions before parsing event / command
    const checkACL = (name: string): boolean => {
      if (!params) return false;

      const channel = params[0];

      if (
        (hasGlobalWhitelist && !isGlobalWhitelisted(name)) ||
        (hasGlobalBlacklist && isGlobalBlacklisted(name))
      ) {
        return false;
      }

      if (options.channels) {
        let channelIndex = -1;

        for (let i = 0; i <= options.channels.length; i++) {
          const option = options.channels[i];

          if (
            typeof option === 'object' &&
            option.name === channel &&
            (option.whitelist || option.blacklist)
          ) {
            channelIndex = i;
            break;
          }
        }

        if (channelIndex !== -1) {
          const channelOption = options.channels[channelIndex];

          const blacklist = (<ChannelConfig>channelOption).blacklist;
          const whitelist = (<ChannelConfig>channelOption).whitelist;

          if (
            whitelist &&
            whitelist.length > 0 &&
            whitelist.indexOf(name) === -1
          ) {
            return false;
          }

          if (
            blacklist &&
            blacklist?.length > 0 &&
            blacklist.indexOf(name) === -1
          ) {
            return false;
          }
        }
      }

      return true;
    };

    // Handle generic events via plugins that arent a command or PRIVMSG
    if (command !== 'PRIVMSG') {
      Object.keys(this.eventHandlers.irc).forEach(async key => {
        const handler = this.eventHandlers.irc[key];

        if (
          checkACL(handler.name) &&
          command?.toUpperCase() === handler.event.toUpperCase()
        ) {
          await handler.handler(context, message, options, this.config.config);
        }
      });

      return;
    }

    if (!params) return;

    const prefix = params[1].charAt(0);
    const isCommand = prefix === options.commandPrefix;

    const commandName = params[1].split(' ')[0].substr(1);
    const commandHandler = this.commands.irc[commandName];

    // Handle non command messages via regex plugins
    if (!isCommand || !commandHandler) {
      Object.keys(this.regexes.irc).forEach(key => {
        const regex = this.regexes.irc[key];

        const matches = regex.regex.test(params[1]);

        if (matches && checkACL(regex.name)) {
          regex.handler(context, message, options, this.config.config);
        }
      });
    }

    // Event is a command instance, parse event through plugins
    if (isCommand && this.commands.irc[commandName]) {
      if (!checkACL(commandHandler.name)) {
        return;
      }

      // command + prefix + space
      const input = params[1].slice(commandName.length + 2);

      this.commands.irc[commandName].handler(
        context,
        message,
        input,
        options,
        this.config.config,
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
      database: this.database,
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

  private async registerIRCHandlers() {
    this.IRCManager.on(
      'message',
      async (client: IRCClient, message: IRCMessage) => {
        const context = this.createIRCContext(client, message);

        this.handleMessage('irc', context, message);
      },
    );

    this.IRCManager.on(
      'event',
      async (client: IRCClient, event: IRCMessage) => {
        const context = this.createIRCContext(client, event);

        this.handleMessage('irc', context, event);
      },
    );

    this.IRCManager.on('sent', async (client: IRCClient, line: string) => {
      console.log('>> ' + line);
    });

    this.IRCManager.on('raw', async (client: IRCClient, line: string) => {
      console.log('<< ' + line);
    });
  }
}
