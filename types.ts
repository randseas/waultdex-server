export default interface User {
  email: string;
  password: string;
  token: string;
  created: string;
  wallets: Array<Wallet>;
}

export interface Wallet {
  name: string;
  keypairs: { eth: string; waultnet: string; solana: string };
}

export interface Pool {
  id: string;
  name: string;
  network: string;
  tokenPair: {
    tokenA: string;
    tokenB: string;
  };
  totalLiquidity: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  reserves: {
    tokenAReserve: number;
    tokenBReserve: number;
  };
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
