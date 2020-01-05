import axios, { AxiosRequestConfig } from 'axios';
import colors from 'irc-colors';

import { RegisterHandler, CommandHandlerCallback } from '../bot';

type IEXResponse = {
  symbol: string;
  companyName: string;
  primaryExchange: string;
  open: number;
  close: number;
  low: number;
  change: number;
  changePercent: number;
  latestPrice: number;
  marketCap: number;
};

export const register: RegisterHandler = ({ registerCommand }) => {
  registerCommand({ name: 'stock', handler: stockHandler });
};

const stockHandler: CommandHandlerCallback = async (
  { respond },
  message,
  input,
  client,
  config,
) => {
  const apiKey = config.stock;
  const { nick } = message;

  if (!apiKey) {
    respond('Missing IEX API Key in `config.stock`');

    return;
  }

  if (!nick) return;

  const [symbol] = input.split(' ');

  if (!symbol || symbol === '') return;

  try {
    const stockInfo = await getStockInfo(symbol, apiKey);
    const response = makeResponse(stockInfo);

    respond(`${nick}: ${response}`);
  } catch (e) {
    respond(`${nick}: ${e.message}`);
  }
};

function makeResponse(info: IEXResponse): string {
  const {
    change,
    changePercent,
    companyName,
    symbol,
    latestPrice,
    marketCap,
  } = info;

  let p = `(${(100 * changePercent).toFixed(2)}%)`;
  let c = parseFloat(change.toFixed(2)).toString();

  if (change < 0) {
    c = colors.red(c);
    p = colors.red(p);
  }

  if (change > 0) {
    c = colors.green(`+ ${c}`);
    p = colors.green(p);
  }

  const name = colors.bold(companyName);
  const lprice = latestPrice.toFixed(2);
  const mcap = formattedMCAP(marketCap);

  return `${symbol} | ${name} | $${lprice} ${c} ${p} | MCAP: $${mcap}`;
}

async function getStockInfo(
  symbol: string,
  token: string,
): Promise<IEXResponse> {
  const url = `https://cloud.iexapis.com/stable/stock/${symbol}/quote`;
  const config: AxiosRequestConfig = {
    params: {
      token,
    },
  };

  const request = await axios.get<IEXResponse>(url, config);

  return request.data;
}

function formattedMCAP(num: number) {
  if (num === null) {
    return null;
  }

  if (num === 0) {
    return '0';
  }

  let fixed = 1;

  let b = num.toPrecision(2).split('e');

  const s = b[1].slice(1);

  let k =
    b.length === 1 ? 0 : Math.floor(Math.min(<number>(<unknown>s), 14) / 3);
  let c = k < 1 ? num : num / Math.pow(10, k * 3);
  let d = (c < 0 ? c : Math.abs(c)).toFixed(2);
  let e = d + ['', 'K', 'M', 'B', 'T'][k];

  return e;
}
