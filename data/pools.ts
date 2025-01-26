import { Pool } from "../types";

export const pools: Pool[] = [
  {
    id: "fr1cx9r-4emfxc-p5xt3qz",
    network: "solana",
    pair: {
      tokenA: "SOL_native",
      tokenB: "USDC_usdc",
    },
    totalLiquidity: 0,
    reserves: {
      tokenAReserve: 0,
      tokenBReserve: 0,
    },
    lowerPrice: 254.51,
    upperPrice: 254.56,
    currentPrice: 254.55,
    feeRate: 0,
    volume: 0,
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
  {
    id: "fr1cx9r-gemfxc-fw321xd",
    network: "solana",
    pair: {
      tokenA: "USDC_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      tokenB: "USD_fiat",
    },
    totalLiquidity: 0,
    reserves: {
      tokenAReserve: 0,
      tokenBReserve: 0,
    },
    lowerPrice: 0.9998,
    upperPrice: 1.0001,
    currentPrice: 1,
    feeRate: 0,
    volume: 0,
    createdAt: Date.now(),
    graph: [],
  },
];
