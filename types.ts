export interface User {
  userId: string;
  email: string;
  password?: string;
  token: string;
  username: string;
  permission: string;
  wallets: Wallet[];
  sessions: Session[];
  created: string;
}
export interface Session {
  token: string;
  session: string;
  device: string;
  ipAddress: string;
  createdAt: string;
  lastSeen: string;
}
export interface Balance {
  id: string;
  symbol: string;
  balance: number;
  valueInUSD: number;
}
export interface Wallet {
  name: string;
  colorScheme: string;
  keypairs: WalletKeypairInterface[];
  balances: Balance[];
}
export interface WalletKeypairInterface {
  public: string;
  private: string;
  type: string;
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
