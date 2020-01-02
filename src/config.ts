import fs from 'fs';

import { IRCConnectionOptions } from './irc/connection';
import { IRCClientOptions } from './irc/client';
import { BotConfig } from './bot';

const ConfigParserError = (message: string): Error => {
  const error = new Error(message);

  error.name = 'ConfigParser';

  return error;
};

export function parseConfigFile(path: string): BotConfig {
  const file: any = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }));

  const botConfig: BotConfig = {};

  if (file.irc && file.irc.clients) {
    file.irc.clients.forEach((clientConfig: any) => {
      const parsedConfig = parseIRCClientConfig(clientConfig);

      botConfig.irc = {
        clients: [],
      };

      botConfig.irc.clients.push(parsedConfig);
    });
  }

  return botConfig;
}

function parseIRCClientConfig(config: any): IRCClientOptions {
  if (!config.commandPrefix) {
    throw ConfigParserError('Client Missing commandPrefix field');
  }

  if (!config.name) {
    throw ConfigParserError('Client Missing name field');
  }

  if (!config.user) {
    throw ConfigParserError('Client missing user object');
  }

  if (!config.user.nickname) {
    throw ConfigParserError('Client user object missing nickname field');
  }

  if (!config.connection) {
    throw ConfigParserError('Client connection object missing');
  }

  const clientConfig = config as IRCClientOptions;

  const connection = parseIRCConnectionConfig(config.connection);

  if (!clientConfig.user.username) {
    clientConfig.user.username = 'coolbot';
  }

  if (!clientConfig.user.username) {
    clientConfig.user.username = 'coolbot';
  }

  if (!clientConfig.user.realname) {
    clientConfig.user.realname = 'Cool Bot';
  }

  clientConfig.connection = connection;

  return clientConfig;
}

function parseIRCConnectionConfig(config: any): IRCConnectionOptions {
  if (!config.host) {
    throw ConfigParserError('Connection host field missing');
  }

  if (!config.port) {
    throw ConfigParserError('Connection port field missing');
  }

  const connectionConfig = config as IRCConnectionOptions;

  return connectionConfig;
}
