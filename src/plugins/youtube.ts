import axios, { AxiosRequestConfig } from 'axios';
import colors from 'irc-colors';

import {
  RegisterHandler,
  CommandHandlerCallback,
  RegexHandlerCallback,
} from '../bot';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_RE = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;

type SearchResult = {
  items: { id: { videoId: string } }[];
};

type VideoInfoItem = {
  id: string;
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: number;
    likeCount: number;
    dislikeCount: number;
    favoriteCount: number;
    commentCount: number;
  };
  snippet: {
    publishedAt: string;
    title: string;
    description: string;
    channelTitle: string;
    localized: {
      title: string;
      description: string;
    };
  };
};

type VideoInfoResult = { items: VideoInfoItem[] };

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

const getYoutubeInfo = async (
  id: string,
  key: string,
): Promise<VideoInfoResult> => {
  const url = `${BASE_URL}/videos?part=snippet,contentDetails,statistics&hl=en`;

  const requestConfig: AxiosRequestConfig = {
    params: {
      id,
      key,
    },
  };

  const request = await axios.get<VideoInfoResult>(url, requestConfig);

  return request.data;
};

const buildResponse = (info: VideoInfoResult): string => {
  const n = new Intl.NumberFormat();

  const s = info.items[0];

  const title = colors.bold(s.snippet.localized.title);

  const duration = colors.bold(
    s.contentDetails.duration.replace('PT', '').toLowerCase(),
  );

  const { likeCount, dislikeCount } = s.statistics;

  const likes = n.format(likeCount ? likeCount : 0);
  const dislikes = n.format(dislikeCount ? dislikeCount : 0);

  const views = colors.bold(n.format(s.statistics.viewCount));

  const channelTitle = colors.bold(s.snippet.channelTitle);

  const p = new Date(Date.parse(s.snippet.publishedAt));
  const date = colors.bold(
    `${p.getFullYear()}.${p.getMonth() + 1}.${p.getDay() + 1}`,
  );

  const videoURL = `https://youtube.com/watch?v=${info.items[0].id}`;

  const sections = [
    title,
    `length ${duration}`,
    `${likes}↑${dislikes}↓`,
    `${views} views`,
    `${channelTitle} on ${date}`,
    videoURL,
  ];

  const response = sections.join(' - ');

  return response;
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

  const response = await axios.get<SearchResult>(url, requestConfig);

  const items = response.data.items;

  if (items.length <= 0) {
    respond(`${message.nick}: No results found.`);

    return;
  }

  const id = response.data.items[0].id.videoId;

  const info = await getYoutubeInfo(id, apiKey);

  const chatResponse = buildResponse(info);

  respond(`${message.nick}: ${chatResponse}`);

  return;
};

const youtubeRegexHandler: RegexHandlerCallback = async (
  { respond, config },
  match,
  message,
) => {
  const apiKey = config.youtube;

  if (!apiKey) {
    return;
  }

  const id = match[7];

  if (!id) return;

  const info = await getYoutubeInfo(id, apiKey);

  const chatResponse = buildResponse(info);

  respond(`${message.nick}: ${chatResponse}`);

  return;
};
