import fs from 'fs';

import cli from 'commander';

import { parseConfigFile, generateConfigFile } from './config';
import { Bot } from './bot';
import app from './web';

if (process.env.DEBUG_BAD_PLUGINS || false) {
  process
    .on('unhandledRejection', (reason, p) => {
      console.error(reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', err => {
      console.error(err, 'Uncaught Exception thrown');
      process.exit(1);
    });
}

const startBot = (configPath: string) => {
  const botConfig = parseConfigFile(configPath);

  const bot = new Bot(botConfig);
  bot.start();
};

cli.version('0.1.0');

cli
  .command('createconfig <destination>')
  .description('output default coolbot config to target destination')
  .action((destination: string) => {
    generateConfigFile(destination);

    console.log('Configuration outputted to', destination);

    return;
  });

cli
  .command('start <configFile>')
  .description('start coolbot with given configuration file')
  .action(path => {
    if (!fs.existsSync(path)) {
      console.log('config file at path does not exist');

      return;
    }

    startBot(path);
  });

cli.parse(process.argv);
