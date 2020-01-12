import axios from 'axios';

import { RegisterHandler, CommandHandlerCallback } from '../src/bot';

type Response = {
  items: {
    title: string;
    link: string;
    snippet: string;
  }[];
};

export const register: RegisterHandler = ({ registerCommand }) => {
  registerCommand({
    name: 'google',
    handler: googleHandler,
  });

  registerCommand({
    name: 'image',
    handler: imageSearchHandler,
  });
};

const googleHandler: CommandHandlerCallback = async (
  { respond, config },
  message,
  input,
) => {
  if (!config.google || config.google === '') {
    respond(`error: missing config.google property`);

    return;
  }

  if (!input) {
    return;
  }

  const response = await getResults(input, config.google);

  const results = response.items;

  if (results.length <= 0) {
    respond(`${message.nick}: no results found`);
  }

  const { title, link } = results[0];

  respond(`${message.nick}: ${title} | ${link}`);
};

const imageSearchHandler: CommandHandlerCallback = async (
  { respond, config },
  message,
  input,
) => {
  if (!config.google || config.google === '') {
    respond(`error: missing config.google property`);

    return;
  }

  if (!input) {
    return;
  }

  const response = await getResults(input, config.google, true);

  const results = response.items;

  if (results.length <= 0) {
    respond(`${message.nick}: no results found`);
  }

  const { title, link } = results[0];

  respond(`${message.nick}: ${title} | ${link}`);
};

async function getResults(
  query: string,
  key: string,
  isImage = false,
): Promise<Response> {
  const baseURL = `https://www.googleapis.com/customsearch/v1?cx=007629729846476161907:ud5nlxktgcw&fields=items(title,link,snippet)&safe=off&nfpr=1&q=${query}&key=${key}&num=1`;
  const imageURL = baseURL + '&searchType=image';

  const url = isImage ? imageURL : baseURL;

  const result = await axios.get(url);

  return result.data;
}
