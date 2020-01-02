import { parseConfigFile } from './config';
import { Bot } from './bot';

const botConfig = parseConfigFile('./test-config.json');

const bot = new Bot(botConfig);

bot.start();
