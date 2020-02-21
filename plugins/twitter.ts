import axios from 'axios';
import Twitter from 'twitter';
import { DateTime } from 'luxon';
import colors from 'irc-colors';

import { RegisterHandler, RegexHandlerCallback } from '../src/bot';

const TWITTER_RE = /\/status\/(\d+)/;

type Tweet = {
  created_at: string;
  id: number;
  text: string;
  full_text: string;
  retweeted: boolean;
  user: {
    screen_name: string;
  };
};

export const register: RegisterHandler = ({ registerRegexHandler }) => {
  registerRegexHandler({
    name: 'twitterre',
    handler: twitterReHandler,
    regex: TWITTER_RE,
  });
};

const checkConfig = (config: Record<string, any>): boolean => {
  const {
    consumer_key,
    consumer_secret,
    access_token_key,
    access_token_secret,
  } = config;

  return (
    consumer_key && consumer_secret && access_token_key && access_token_secret
  );
};

const createClient = (config: Record<string, any>): Twitter => {
  const isValidConfig = checkConfig(config);

  if (!isValidConfig) {
    throw new Error('invalid configuration');
  }

  const client = new Twitter(config as Twitter.AccessTokenOptions);

  return client;
};

const twitterReHandler: RegexHandlerCallback = async (
  { respond, config },
  match,
  message,
) => {
  try {
    const client = createClient(config.twitter);

    const id = match[1];

    const result = await client.get('statuses/show', {
      id,
      tweet_mode: 'extended',
    });

    const tweet = result as Tweet;

    const timestamp = DateTime.fromFormat(
      tweet.created_at,
      'ccc LLL dd TT ZZZ y',
    ).toHTTP();

    const text = decodeURI(tweet.full_text).replace(/(\r\n|\n|\r)/gm, ' ');
    const user = colors.bold(tweet.user.screen_name);

    const output = `${timestamp} ${user}: ${text}`;

    respond(`${message.nick}: ${output}`);
  } catch (e) {
    const message = e.length ? e.map((x: any) => x.message).join(', ') : e;

    respond(`${message.nick}: ${message}`);
  }
};
