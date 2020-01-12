import axios from 'axios';

import { CommandHandlerCallback, RegisterHandler } from '../src/bot';

export const register: RegisterHandler = ({ registerCommand }) => {
  registerCommand({
    name: 'wa',
    handler: calcHandler,
    aliases: ['calc'],
  });
};

const calcHandler: CommandHandlerCallback = async (
  { respond, config },
  message,
  input,
) => {
  const baseURL = 'http://api.wolframalpha.com/v1/conversation.jsp';

  if (!input) {
    return;
  }

  if (!config.wolfram) {
    respond(`${message.nick}: missing config.wolfram property`);

    return;
  }

  const apiKey = config.wolfram;

  const query = input
    .split(' ')
    .map(x => x.replace('+', '%2B'))
    .join('+');

  const url = `${baseURL}?appid=${apiKey}&i=${query}`;

  try {
    const request = await axios.get(url);

    respond(`${message.nick}: ${request.data.result}`);
  } catch (e) {
    console.log('error', e.response.data);
  }
};
