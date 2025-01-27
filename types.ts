export interface User {
  userId: string;
  email: string;
  password: string;
  token: string;
  username: string;
  permission: string;
  wallets: Wallet[];
  created: string;
}
export interface Wallet {
  name: string;
  network: string;
  keypairs: WalletKeypairInterface[];
}
export interface WalletKeypairInterface {
  public: string;
  private: string;
}
export interface Pair {
  tokenA: string;
  tokenB: string;
}
export interface Reserves {
  tokenAReserve: number;
  tokenBReserve: number;
}
export interface Pool {
  id: string;
  network: string;
  pair: Pair;
  totalLiquidity: number;
  reserves: Reserves;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  feeRate: number;
  volume: number;
  createdAt: number;
}
export interface FuturesPool {
  id: string;
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