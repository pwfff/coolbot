import axios from 'axios';
import colors from 'irc-colors';

import { RegisterHandler, CommandHandlerCallback } from '../bot';

type GeoAPIResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type WeatherDoc = {
  zip: string;
};

type DailyWeatherData = {
  time: number;
  summary: string;
  precipProbability: number;
  temperatureHigh: number;
  temperatureLow: number;
};

type WeatherResult = {
  location: GeoAPIResult;
  currently: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windGust: number;
  };
  daily: {
    summary: string;
    data: DailyWeatherData[];
  };
};

export const register: RegisterHandler = ({ registerCommand }) => {
  registerCommand({ name: 'weather', handler: weatherHandler });
};

const weatherHandler: CommandHandlerCallback = async (
  { respond, database },
  message,
  input,
  client,
  config,
) => {
  const apiKey = config.weather;
  let { nick } = message;

  if (!apiKey) {
    respond('Missing darksky API Key in `config.weather`');

    return;
  }

  if (!nick) return;

  let [zip, argument] = input.split(' ');

  if (zip.startsWith('@')) {
    zip = '';
    nick = zip.substr(1);
  }

  const clientName = client.name;

  if ((zip || zip !== '') && argument !== 'dontsave') {
    saveZip(database, clientName, nick, zip);
  }

  if (!zip || zip === '') {
    zip = await lookupZip(database, clientName, nick);
  }

  if (zip === '') {
    return;
  }

  try {
    const result = await getForecast(zip, apiKey);

    const getTempString = (temp: number): string => {
      return `${temp.toFixed(2)}F/${toCelsius(temp)}C`;
    };

    const { temperature, humidity, windGust, windSpeed } = result.currently;
    const { temperatureHigh, temperatureLow, summary } = result.daily.data[0];

    const currentTemp = getTempString(temperature);
    const lowTemp = getTempString(temperatureHigh);
    const highTemp = getTempString(temperatureLow);

    const locationName = result.location.display_name;

    const gust = `${windGust.toFixed(2)}mph/${toKilometers(windGust)}kph`;
    const h = (humidity * 100).toFixed();
    const sum = colors.bold(summary);

    const response = `${locationName}: ${currentTemp}(H:${highTemp},L:${lowTemp}), Humidity: ${h}%, ${gust} ${sum}`;

    respond(response);
  } catch (e) {
    respond(`Error fetching weather: ${e.message}`);
  }
};

async function getForecast(
  zip: string,
  apiKey: string,
): Promise<WeatherResult> {
  const geoURL = `https://nominatim.openstreetmap.org/search.php?q=${zip}&format=json`;
  const geoAPIResult = await axios.get<GeoAPIResult[]>(geoURL);

  const geoData = geoAPIResult.data;

  if (geoData.length <= 0) {
    throw new Error('Location code not found');
  }

  const { lat, lon } = geoData[0];

  const weatherURL = `https://api.darksky.net/forecast/${apiKey}/${lat},${lon}`;
  const weatherResults = await axios.get<WeatherResult>(weatherURL);

  const weatherData = weatherResults.data;
  weatherData.location = geoData[0];

  return weatherData;
}

async function saveZip(
  db: PouchDB.Database,
  clientName: string,
  nick: string,
  input: string,
) {
  const key = `weather:${clientName}:${nick}`;
  const current = await db.get<WeatherDoc>(key);

  await db.put<WeatherDoc>({ ...current, zip: input });
}

async function lookupZip(
  db: PouchDB.Database,
  clientName: string,
  nick: string,
): Promise<string> {
  const key = `weather:${clientName}:${nick}`;

  try {
    const result = await db.get<WeatherDoc>(key);
    return result.zip;
  } catch (e) {
    return '';
  }
}

function toCelsius(temp: number): string {
  return ((temp - 32) * (5 / 9)).toFixed(2);
}

function toKilometers(miles: number): string {
  return (miles * 1.6).toFixed(2);
}
