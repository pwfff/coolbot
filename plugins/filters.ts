import { RegisterHandler, FilterHandlerCallback, Message } from '../src/bot';

export const register: RegisterHandler = ({ registerFilter }) => {
  registerFilter({ name: 'spamwords', handler: spamHandler });
  registerFilter({ name: 'botfilter', handler: botFilter });
};

const botFilter: FilterHandlerCallback = (message: Message, { config }) => {
  if (!message) {
    return message;
  }

  const filterBots = config?.filterBots ? config.filterBots : true;

  if (filterBots && message.nick?.includes('bot')) {
    return null;
  }

  return message;
};

const spamHandler: FilterHandlerCallback = (message: Message, { config }) => {
  if (!message) {
    return null;
  }

  if (message?.command !== 'PRIVMSG') {
    return message;
  }

  if (!message.params) {
    return message;
  }

  const [, contents] = message.params;

  const FILTERED_WORDS = [
    'DCC SEND',
    '1nj3ct',
    'thewrestlinggame',
    'startkeylogger',
    'hybux',
    '\\0',
    '\\x01',
    '!coz',
    '!tell /x',
  ];

  const filtered: boolean =
    FILTERED_WORDS.filter(word => !filtered && contents.includes(word)).length >
    0;

  const result = filtered ? null : message;

  return result;
};
