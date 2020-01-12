import axios from 'axios';
import colors from 'irc-colors';

import { RegisterHandler, CommandHandlerCallback } from '../src/bot';

type LastfmDoc = {
  _id: string;
  doc_type: string;
  username: string;
};

type LastfmTrack = {
  artist: { '#text': string };
  '@attr'?: { nowplaying: boolean };
  album: { '#text': string };
  name: string;
};

type LastfmResponse = {
  recenttracks: {
    '@attr': {
      user: string;
    };
    track: LastfmTrack[];
  };
};

export const register: RegisterHandler = ({ registerCommand }) => {
  registerCommand({ name: 'lastfm', handler: lastfmHandler });
};

const lastfmHandler: CommandHandlerCallback = async (
  { respond, database, config, options },
  message,
  input,
) => {
  if (!message.nick) {
    return;
  }

  const apiKey = config.lastfm;

  if (!apiKey) {
    respond(`error: missing config.lastfm property`);
  }

  const baseURL = 'http://ws.audioscrobbler.com/2.0/?format=json';

  const params = input.split(' ');

  let username: string | null = null;
  let nick = message.nick;
  let shouldSave = false;

  if (params[0] && params[0] !== '') {
    const arg = params[0];

    if (arg.startsWith('@')) {
      nick = arg.substring(1);
    } else {
      username = arg;
      shouldSave = params[1] !== 'dontsave';
    }
  }

  if (params[0].startsWith('@')) {
    nick = params[0].substring(1);
  }

  const dbKey = `${options.name}:${nick}:lastfm`;

  if (!username) {
    try {
      const query = await database.get<LastfmDoc>(dbKey);

      username = query.username;
    } catch (e) {
      respond(`${message.nick}: user not found`);

      return;
    }
  }

  const url = `${baseURL}&method=user.getrecenttracks&api_key=${apiKey}&user=${username}&limit=1`;

  try {
    const response = await axios.get<LastfmResponse>(url);

    const tracks = response.data;

    if (
      !tracks.recenttracks ||
      !tracks.recenttracks.track ||
      tracks.recenttracks.track.length === 0
    ) {
      respond(`${message.nick}: no recent tracks found`);
    }

    const track = tracks.recenttracks.track[0];

    const status = track['@attr']?.nowplaying ? 'current' : 'last';

    const user = colors.bold(tracks.recenttracks['@attr'].user.toLowerCase());
    const title = colors.bold(track.name);
    const album = colors.bold(track.album['#text']);
    const artist = colors.bold(track.artist['#text']);

    respond(`${user}'s ${status} track - ${title} by ${artist} on ${album}`);
  } catch (e) {
    const error = e.response.data;

    respond(`${message.nick}: lastfm error - ${error.message}`);
  }

  if (shouldSave) {
    let doc: LastfmDoc;

    try {
      doc = await database.get(dbKey);
    } catch (e) {
      doc = {
        _id: dbKey,
        doc_type: 'lastfm',
        username,
      };
    }

    if (doc.username !== username) {
      doc.username = username;
    }

    try {
      await database.put<LastfmDoc>(doc);
    } catch (e) {
      console.log(e);
    }
  }
};
