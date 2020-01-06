import axios, { AxiosRequestConfig } from 'axios';

import {
  RegisterHandler,
  CommandHandlerCallback,
  RegexHandlerCallback,
} from '../bot';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_RE = /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

export const register: RegisterHandler = ({
  registerCommand,
  registerRegexHandler,
}) => {
  registerCommand({
    name: 'youtube',
    handler: youtubeHandler,
    aliases: ['yt'],
  });

  registerRegexHandler({
    name: 'youtubere',
    handler: youtubeRegexHandler,
    regex: YOUTUBE_RE,
  });
};

const youtubeHandler: CommandHandlerCallback = async (
  { respond, config },
  message,
  input,
) => {
  const apiKey = config.youtube;

  if (!apiKey) {
    respond('Missing API key in config.youtube');
    return;
  }

  const url = `${BASE_URL}/search`;

  const requestConfig: AxiosRequestConfig = {
    params: {
      key: apiKey,
      fields: 'items(id(videoId))',
      part: 'snippet',
      type: 'video',
      maxResults: '1',
      q: input,
    },
  };

  const response = await axios.get(url, requestConfig);
};

const youtubeRegexHandler: RegexHandlerCallback = async () => {};
