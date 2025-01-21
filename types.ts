export default interface User {
  email: string;
  password: string;
  token: string;
  created: string;
  wallets: Array<Wallet>;
}
export interface Wallet {
  name: string;
  keypairs: {
    chain: string;
    publickey: string;
    secretkey: string;
  }[];
}
export interface Pool {
  id: string;
  network: string;
  pair: {
    tokenA: string; // TICKER_ADDRESS
    tokenB: string; // TICKER_ADDRESS
  };
  totalLiquidity: number;
  volume: number;
  apr: number;
  reserves: {
    tokenAReserve: number;
    tokenBReserve: number;
  };
  graph: Array<Candle>;
  feeRate: number;
  createdAt: Date;
}
export interface Token {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  network: string;
  logoUrl: string;
}
export interface Network {
  name: string;
  symbol: string;
  address: string;
  explorer: string;
}
export interface Candle {
  time: number; // Unix timestamp
  open: number; // Open price
  high: number; // Highest price
  low: number; // Lowest price
  close: number; // Close price
  volume: number; // Market cap
}
