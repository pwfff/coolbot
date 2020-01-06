import { RegisterHandler, EventHandlerCallback } from '../bot';

export const register: RegisterHandler = ({ registerEventHandler }) => {
  registerEventHandler({
    name: 'invite',
    event: 'INVITE',
    handler: inviteHandler,
  });
};

const inviteHandler: EventHandlerCallback = async ({ sendRaw }, event) => {
  if (!event.params) return;

  const [, channel] = event.params;

  if (!channel) return;

  sendRaw(`JOIN ${channel}`);
};
