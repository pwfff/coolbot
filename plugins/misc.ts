import {
  RegisterHandler,
  EventHandlerCallback,
  CommandHandlerCallback,
} from '../src/bot';

export const register: RegisterHandler = ({
  registerEventHandler,
  registerCommand,
}) => {
  registerEventHandler({
    name: 'invite',
    event: 'INVITE',
    handler: inviteHandler,
  });

  registerEventHandler({
    name: 'newNick',
    event: '433',
    handler: newNickHandler,
  });

  registerCommand({
    name: 'help',
    handler: helpHandler,
  });
};

const inviteHandler: EventHandlerCallback = async ({ sendRaw }, event) => {
  if (!event.params) return;

  const [, channel] = event.params;

  if (!channel) return;

  sendRaw(`JOIN ${channel}`);
};

const newNickHandler: EventHandlerCallback = async ({ sendRaw, options }) => {
  const currentNick = options.user.nickname;

  const newNick = currentNick + '_';

  sendRaw(`NICK ${newNick}`);
};

const helpHandler: CommandHandlerCallback = async (
  { bot, sendMessage },
  message,
) => {
  const commands = Object.keys(bot.commands).join(', ');

  sendMessage(message.nick!, `Available commands: ${commands}`);
};
