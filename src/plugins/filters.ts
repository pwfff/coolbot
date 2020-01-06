import { RegisterHandler, FilterHandlerCallback, Message } from '../bot';

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

export const register: RegisterHandler = ({
  registerFilter,
  registerCommand,
}) => {
  registerFilter({ name: 'spamwords', handler: spamHandler });
};

const spamHandler: FilterHandlerCallback = (message: Message) => {
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
