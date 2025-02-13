export interface User {
  userId: string;
  email: string;
  password?: string;
  username: string;
  otp?: string | null;
  permission: string;
  wallets: Wallet[];
  sessions: Session[];
  created: string;
}
export interface Session {
  token: string;
  device: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeen: string;
}
export interface Balance {
  id: string;
  balance: string;
  valueInUSD?: number;
}
export interface Wallet {
  name: string;
  colorScheme: string;
  keypairs: WalletKeypairInterface[];
  balances: Balance[];
  //client stuff
  totalBalanceInUSD?: number;
}
export interface WalletKeypairInterface {
  public: string;
  private: string;
  type: "secp256k1" | "ed25519" | "bech32" | string;
}
export type NetworkType = "ed25519" | "secp256k1";
export interface Network {
  id: string;
  img: string;
  name: string;
  ticker: string;
  explorer: string;
  type: NetworkType;
}
export interface SpotMarket {
  id: string;
  img: string;
  ticker: string;
  name: string;
  price?: string;
  mcap?: string;
  volume24h?: string;
  change24h?: string;
  networks?: Array<string>;
}
export interface FuturesMarket {
  id: string;
  img: string;
  ticker: string;
  name: string;
  price?: string;
  markPrice?: string;
}
export interface Candle {
  time: number; // Unix timestamp
  open: number; // Open price
  high: number; // Highest price
  low: number; // Lowest price
  close: number; // Close price
  volume: number; // Market cap
  resolution?: string;
}
