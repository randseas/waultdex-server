import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId | undefined;
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
  _id?: string;
  token: string;
  device: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeen: string;
}
export interface Balance {
  _id?: string;
  id: string;
  balance: string;
  valueInUSD?: number;
}
export interface Wallet {
  _id?: string;
  name: string;
  colorScheme: string;
  keypairs: WalletKeypairInterface[];
  balances: Balance[];
  totalBalanceInUSD?: number;
}
export interface WalletKeypairInterface {
  _id?: string;
  type: "secp256k1" | "ed25519" | "bech32" | string;
  network: string;
  public: string;
  private: string;
}
export type NetworkType = "ed25519" | "secp256k1";
export interface Network {
  _id?: string;
  id: string;
  img: string;
  name: string;
  ticker: string;
  explorer: string;
  type: NetworkType;
}
export interface SpotMarket {
  _id?: string;
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
  _id?: string;
  id: string;
  img: string;
  ticker: string;
  name: string;
  price?: string;
  markPrice?: string;
}
export interface Candle {
  _id?: string;
  time: number; // Unix timestamp
  open: number; // Open price
  high: number; // Highest price
  low: number; // Lowest price
  close: number; // Close price
  volume: number; // Market cap
  resolution?: string;
}
