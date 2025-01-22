import { Pool } from "../types";

export const pools: Pool[] = [
  {
    id: "fr1cx9r-4emfxc-p5xt3qz",
    network: "solana",
    pair: {
      tokenA: "WX_wx", // TICKER_ADDRESS
      tokenB: "USDT_usdt", // TICKER_ADDRESS
    },
    totalLiquidity: 1000000,
    reserves: {
      tokenAReserve: 1000000,
      tokenBReserve: 1000000,
    },
    lowerPrice: 0,
    upperPrice: 0,
    currentPrice: 0,
    feeRate: 0,
    volume: 100,
    createdAt: Date.now(),
    graph: [
      {
        time: 1736177230,
        open: 0.15,
        high: 0.17,
        low: 0.14,
        close: 0.16,
        volume: 12,
      },
      {
        time: 1736177290,
        open: 0.16,
        high: 0.18,
        low: 0.15,
        close: 0.17,
        volume: 16,
      },
    ],
  },
];
