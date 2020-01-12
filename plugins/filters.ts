import { RegisterHandler, FilterHandlerCallback, Message } from '../src/bot';

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

  let filtered = false;
  FILTERED_WORDS.forEach(word => {
    if (!filtered && contents.includes(word)) {
      filtered = true;
    }
  });

  const result = filtered ? null : message;

  return result;
};
