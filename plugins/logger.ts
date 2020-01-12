import { RegisterHandler, EventHandlerCallback } from '../src/bot';
import { IRCMessage } from '../src/irc/message';

type LogEntry = {
  _id?: string;
  doc_type: string;
  client: string;
  event: IRCMessage;
};

export const register: RegisterHandler = ({ registerEventHandler }) => {
  registerEventHandler({ name: 'logger', event: '*', handler: loggerHandler });
};

const loggerHandler: EventHandlerCallback = async (
  { database, options },
  event,
) => {
  const filteredEvents = [
    'PING',
    'PONG',
    '372',
    '376',
    '375',
    '001',
    '002',
    '003',
    '004',
    '005',
    '251',
    '252',
    '253',
    '254',
    '255',
    '265',
    '266',
  ];

  if (!event.command || filteredEvents.includes(event.command)) {
    return;
  }

  const logEntry: LogEntry = {
    doc_type: 'eventlog',
    client: options.name,
    event,
  };

  database.post<LogEntry>(logEntry);
};
