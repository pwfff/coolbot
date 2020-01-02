import {
  RegisterHandler,
  CommandHandlerCallback,
  EventHandlerCallback,
  RegexHandlerCallback,
} from '../bot';

export const register: RegisterHandler = ({
  registerCommand,
  registerEventHandler,
  registerRegexHandler,
}) => {
  registerCommand({
    name: 'echo',
    handler: echo,
  });

  registerEventHandler({
    name: 'joiner',
    event: 'INVITE',
    handler: joiner,
  });

  registerRegexHandler({
    name: 'butts',
    regex: /butts/,
    handler: butts,
  });
};

const echo: CommandHandlerCallback = ({ respond }, message, input, config) => {
  respond(`${message.nick}: ${message}`);
};

const joiner: EventHandlerCallback = ({ sendRaw, sendMessage }, event) => {
  const channel = event.params![1];

  sendRaw(`JOIN ${channel}`);
  sendMessage(channel, 'Hello I am here.');
};

const butts: RegexHandlerCallback = ({ respond }) => {
  respond('butts butts butts');
};
