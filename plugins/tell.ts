import { DateTime } from 'luxon';
import colors from 'irc-colors';

import {
  RegisterHandler,
  CommandHandlerCallback,
  EventHandlerCallback,
} from '../src/bot';

type Message = {
  from: string;
  channel: string;
  contents: string;
  timestamp: string;
};

type MessageLog = {
  _id: string;
  doc_type: string;
  messages: Message[];
};

type DBHelper = {
  getMessages(key: string): Promise<MessageLog>;
  saveMessage(key: string, message: Message): Promise<void>;
  deleteMessages(key: string): Promise<void>;
  popMessage(key: string): Promise<Message | undefined>;
};

export const register: RegisterHandler = ({
  registerEventHandler,
  registerCommand,
}) => {
  registerEventHandler({
    event: 'PRIVMSG',
    handler: tellEventHandler,
    name: 'tell',
  });

  registerCommand({
    name: 'tell',
    handler: tellCommand,
  });
};

const dbhelper = (database: PouchDB.Database): DBHelper => {
  const getMessages = async (key: string): Promise<MessageLog> => {
    let doc: MessageLog;

    try {
      doc = await database.get<MessageLog>(key);
    } catch (e) {
      doc = {
        _id: key,
        doc_type: 'tell',
        messages: [],
      };
    }

    return doc;
  };

  const popMessage = async (key: string): Promise<Message | undefined> => {
    const messageLog = await getMessages(key);

    const message = messageLog.messages.pop();

    const doc = {
      ...messageLog,
    };

    await database.put<MessageLog>(doc);

    return message;
  };

  const saveMessage = async (key: string, message: Message) => {
    const messageLog = await getMessages(key);

    const doc = {
      ...messageLog,
      messages: [...messageLog.messages, message],
    };

    database.put<MessageLog>(doc);
  };

  const deleteMessages = async (key: string) => {
    const messages = await getMessages(key);

    const doc = {
      ...messages,
      messages: [],
    };

    database.put(doc);
  };

  return {
    getMessages,
    saveMessage,
    deleteMessages,
    popMessage,
  };
};

const tellCommand: CommandHandlerCallback = async (
  { respond, database, options },
  message,
  input,
) => {
  const inputs = input.split(' ');

  if (inputs.length <= 0) {
    respond(
      `${message.nick!}: tell <target> <message> - sends <message> to <target>`,
    );

    return;
  }

  const db = dbhelper(database);
  const key = createKey(options.name, inputs[0]);

  const messages = await db.getMessages(key);
  const messageCount = messages.messages.length;

  if (messageCount >= 5) {
    respond(`${message.nick}: User has too many messages queued.`);

    return;
  }

  const contents = [...inputs];

  contents.splice(0, 1);

  const newMessage: Message = {
    from: message.nick!,
    channel: message.params![0],
    contents: contents.join(' '),
    timestamp: DateTime.local().toISO(),
  };

  await db.saveMessage(key, newMessage);

  respond(`${message.nick}: Sent.`);
};

const tellEventHandler: EventHandlerCallback = async (
  { respond, database, options, sendMessage },
  event,
) => {
  const db = dbhelper(database);
  const key = createKey(options.name, event.nick!);

  try {
    const log = await db.getMessages(key);

    if (!log.messages || log.messages.length === 0) {
      return;
    }
  } catch (e) {
    console.log('[!] Database Error in `tell`:', e);
  }

  const message = await db.popMessage(key);

  if (!message) {
    return;
  }

  const start = DateTime.fromISO(message.timestamp);
  const end = DateTime.local();

  // Bad types on this library
  const diffTypes = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];

  const diff = end.diff(start, [
    'years',
    'months',
    'days',
    'hours',
    'minutes',
    'seconds',
  ]);

  const d = diff as any;

  const time = diffTypes
    .filter(type => d[type] !== 0)
    .map(type => `${d[type]} ${type}`)
    .join(', ');

  const { from, channel } = message;

  const response = `${colors.bold(from)} ${time} ago in ${channel}:`;

  sendMessage(event.nick!, response);
  sendMessage(event.nick!, message.contents);
};

const createKey = (server: string, nick: string) => `${server}:${nick}`;
