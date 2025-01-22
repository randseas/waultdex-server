import { FuturesPool } from "../types";

export const futuresPools: FuturesPool[] = [
  {
    id: "fr1cx9r-4emfxc-b4523ef",
    network: "solana",
    pair: {
      tokenA: "WX_wx", // TICKER_ADDRESS
      tokenB: "USDT_usdt", // TICKER_ADDRESS
    },
    totalLiquidity: 1000000,
    totalOpenInterest: 225,
    feeRate: 0.1,
    fundingRate: 0.02,
    openPositions: 0.0,
    currentPrice: 11,
    markPrice: 12,
    createdAt: Date.now(),
  },
];
