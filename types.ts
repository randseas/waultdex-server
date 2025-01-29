import { Decimal128 } from "mongodb";

export interface IUserInterface {
  userId?: string;
  email: string;
  password?: string;
  token: string;
  username?: string;
  permission: string;
  wallets: IWalletInterface[];
  created: string;
}
export interface IWalletInterface {
  name: string;
  keypairs: IWalletKeypairInterface[];
}
export interface IWalletKeypairInterface {
  public: string;
  private: string;
  type: string;
}
export interface Pair {
  tokenA: string;
  tokenB: string;
}
export interface Reserves {
  tokenAReserve: Decimal128;
  tokenBReserve: Decimal128;
}
export interface Pool {
  address: string;
  network: string;
  pair: Pair;
  totalLiquidity: Decimal128;
  reserves: Reserves;
  lowerPrice: Decimal128;
  upperPrice: Decimal128;
  currentPrice: Decimal128;
  feeRate: Decimal128;
  volume: Decimal128;
  createdAt: number;
}
export interface FuturesPool {
  address: string;
  network: string;
  pair: {
    tokenA: string;
    tokenB: string;
  };
  totalLiquidity: number;
  totalOpenInterest: number; // Açık pozisyonların toplam büyüklüğü (USD cinsinden)
  feeRate: number; // İşlem ücreti oranı (örn: 0.001 = %0.1)
  fundingRate: number; // Fonlama oranı (periyodik olarak long/short arasında aktarılır)
  openPositions: number; // Havuzdaki toplam açık pozisyon sayısı
  currentPrice: number;
  markPrice: number; // Fonlama oranı ve spot piyasa fiyatının formülle hesaplanmış fiyatıdır
  createdAt: number;
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
