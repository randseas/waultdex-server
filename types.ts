export interface User {
  userId: string;
  email: string;
  password?: string;
  token: string;
  username: string;
  permission: string;
  wallets: Wallet[];
  created: string;
}
export interface Balance {
  symbol: string;
  network: string;
  balance: number;
  tokenAccount: string;
  address: string;
  valueInUSD: number;
}
export interface Wallet {
  name: string;
  keypairs: WalletKeypairInterface[];
  //only client context
  balances: Balance[];
  totalBalanceInUSD?: number;
  totalBalanceInTRY?: number;
}
export interface WalletKeypairInterface {
  public: string;
  private: string;
  network: string;
}
export interface SpotMarket {
  id: string;
  img: string;
  ticker: string;
  name: string;
}
export interface FuturesMarket {
  id: string;
  img: string;
  ticker: string;
  name: string;
}
export interface Candle {
  time: number; // Unix timestamp
  open: number; // Open price
  high: number; // Highest price
  low: number; // Lowest price
  close: number; // Close price
  volume: number; // Market cap
}
